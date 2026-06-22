import { describe, expect, it } from "vitest";
import {
  compileToSql,
  parseQuery,
  toTaskQuery,
} from "../src/core/query-dsl.js";
import type { TaskQuery } from "../src/shared/types.js";

describe("query-dsl: parseQuery basics", () => {
  it("parses a simple field:value", () => {
    const p = parseQuery("state:in_progress");
    expect(p.clauses).toEqual([
      { field: "state", op: "eq", value: "in_progress" },
    ]);
    expect(p.freeText).toBe("");
  });

  it("collects bare words as free text", () => {
    const p = parseQuery("login bug crash");
    expect(p.clauses).toEqual([]);
    expect(p.freeText).toBe("login bug crash");
  });

  it("mixes clauses and free text", () => {
    const p = parseQuery("priority:high needs review");
    expect(p.clauses).toEqual([{ field: "priority", op: "eq", value: "high" }]);
    expect(p.freeText).toBe("needs review");
  });

  it("treats unknown fields as free text", () => {
    const p = parseQuery("foo:bar");
    expect(p.clauses).toEqual([]);
    expect(p.freeText).toBe("foo:bar");
  });

  it("returns empty for empty / whitespace input", () => {
    expect(parseQuery("")).toEqual({ clauses: [], freeText: "" });
    expect(parseQuery("   \t\n ")).toEqual({ clauses: [], freeText: "" });
  });

  it("does not throw on empty/blank input and yields a match-all query", () => {
    // Regression: an empty query used to crash with
    // `TypeError: Cannot read properties of null (reading '0')`.
    expect(() => parseQuery("")).not.toThrow();
    expect(() => parseQuery("   ")).not.toThrow();
    expect(compileToSql(toTaskQuery(parseQuery("")))).toEqual({
      where: "1 = 1",
      params: [],
    });
  });
});

describe("query-dsl: quotes", () => {
  it("keeps a quoted phrase as a single free-text token", () => {
    const p = parseQuery('"needs review" priority:high');
    expect(p.freeText).toBe("needs review");
    expect(p.clauses).toEqual([{ field: "priority", op: "eq", value: "high" }]);
  });

  it("supports field:\"quoted value\" with embedded spaces", () => {
    const p = parseQuery('search:"login bug"');
    expect(p.clauses).toEqual([
      { field: "search", op: "contains", value: "login bug" },
    ]);
  });

  it("a quoted AND is literal text, not an operator", () => {
    const p = parseQuery('"AND"');
    expect(p.freeText).toBe("AND");
    expect(p.clauses).toEqual([]);
  });

  it("tolerates an unterminated quote by taking the rest", () => {
    const p = parseQuery('"unterminated phrase');
    expect(p.freeText).toBe("unterminated phrase");
  });
});

describe("query-dsl: operators & lists", () => {
  it("comma list -> in", () => {
    const p = parseQuery("state:todo,in_progress,blocked");
    expect(p.clauses).toEqual([
      { field: "state", op: "in", value: ["todo", "in_progress", "blocked"] },
    ]);
  });

  it("! prefix -> neq", () => {
    const p = parseQuery("priority:!low");
    expect(p.clauses).toEqual([{ field: "priority", op: "neq", value: "low" }]);
  });

  it("due:< -> before and due:> -> after", () => {
    const p = parseQuery("due:<2026-07-01 due:>2026-01-01");
    expect(p.clauses).toEqual([
      { field: "due", op: "before", value: "2026-07-01" },
      { field: "due", op: "after", value: "2026-01-01" },
    ]);
  });

  it("search field uses contains", () => {
    const p = parseQuery("search:foo");
    expect(p.clauses).toEqual([{ field: "search", op: "contains", value: "foo" }]);
  });
});

describe("query-dsl: boolean operators & precedence", () => {
  it("explicit AND between clauses", () => {
    const p = parseQuery("state:todo AND priority:high");
    expect(p.clauses).toEqual([
      { field: "state", op: "eq", value: "todo" },
      { field: "priority", op: "eq", value: "high" },
    ]);
  });

  it("OR between clauses (flattened, order preserved)", () => {
    const p = parseQuery("state:todo OR state:blocked");
    expect(p.clauses).toEqual([
      { field: "state", op: "eq", value: "todo" },
      { field: "state", op: "eq", value: "blocked" },
    ]);
  });

  it("parentheses group without throwing and preserve order", () => {
    const p = parseQuery("(state:todo OR state:blocked) AND priority:urgent");
    expect(p.clauses).toEqual([
      { field: "state", op: "eq", value: "todo" },
      { field: "state", op: "eq", value: "blocked" },
      { field: "priority", op: "eq", value: "urgent" },
    ]);
  });

  it("is case-insensitive for and / or", () => {
    const p = parseQuery("state:todo or state:done");
    expect(p.clauses.map((c) => c.value)).toEqual(["todo", "done"]);
  });

  it("tolerates an unmatched open paren", () => {
    const p = parseQuery("(state:todo AND priority:high");
    expect(p.clauses).toEqual([
      { field: "state", op: "eq", value: "todo" },
      { field: "priority", op: "eq", value: "high" },
    ]);
  });

  it("tolerates leading/dangling operators", () => {
    const p = parseQuery("AND state:todo OR");
    expect(p.clauses).toEqual([{ field: "state", op: "eq", value: "todo" }]);
  });

  it("nested parentheses flatten correctly", () => {
    const p = parseQuery("((priority:high OR priority:urgent) AND state:todo)");
    expect(p.clauses.map((c) => `${c.field}:${c.value}`)).toEqual([
      "priority:high",
      "priority:urgent",
      "state:todo",
    ]);
  });
});

describe("query-dsl: toTaskQuery", () => {
  it("single state -> scalar, multiple -> array", () => {
    expect(toTaskQuery(parseQuery("state:todo")).state).toBe("todo");
    expect(toTaskQuery(parseQuery("state:todo,blocked")).state).toEqual([
      "todo",
      "blocked",
    ]);
  });

  it("drops invalid enum values", () => {
    const q = toTaskQuery(parseQuery("state:nonsense priority:high"));
    expect(q.state).toBeUndefined();
    expect(q.priority).toBe("high");
  });

  it("assignee:none maps to null", () => {
    expect(toTaskQuery(parseQuery("assignee:none")).assigneeId).toBeNull();
    expect(toTaskQuery(parseQuery("assignee:u_42")).assigneeId).toBe("u_42");
  });

  it("accumulates labels and maps project", () => {
    const q = toTaskQuery(parseQuery("label:a label:b project:p1"));
    expect(q.labels).toEqual(["a", "b"]);
    expect(q.projectId).toBe("p1");
  });

  it("maps due before/after", () => {
    const q = toTaskQuery(parseQuery("due:<2026-07-01 due:>2026-01-01"));
    expect(q.dueBefore).toBe("2026-07-01");
    expect(q.dueAfter).toBe("2026-01-01");
  });

  it("routes free text into search", () => {
    expect(toTaskQuery(parseQuery("hello world")).search).toBe("hello world");
  });

  it("multi-value enums come from comma-lists (in)", () => {
    const q = toTaskQuery(parseQuery("state:todo,in_progress priority:high,urgent"));
    expect(q.state).toEqual(["todo", "in_progress"]);
    expect(q.priority).toEqual(["high", "urgent"]);
  });

  it("repeated scalar clauses for the same field: last write wins", () => {
    // `state:todo OR state:in_progress` flattens to two independent clauses;
    // toTaskQuery maps each in turn, so the later one wins.
    const q = toTaskQuery(parseQuery("state:todo OR state:in_progress"));
    expect(q.state).toBe("in_progress");
  });

  it("end-to-end: complex query", () => {
    const q = toTaskQuery(
      parseQuery(
        'state:todo,in_progress priority:high,urgent label:backend assignee:u1 "fix login"',
      ),
    );
    expect(q.state).toEqual(["todo", "in_progress"]);
    expect(q.priority).toEqual(["high", "urgent"]);
    expect(q.labels).toEqual(["backend"]);
    expect(q.assigneeId).toBe("u1");
    expect(q.search).toBe("fix login");
  });
});

describe("query-dsl: compileToSql", () => {
  it("defaults to a safe always-true fragment", () => {
    expect(compileToSql({})).toEqual({ where: "1 = 1", params: [] });
  });

  it("binds projectId / assignee / search as params (never interpolated)", () => {
    const f = compileToSql({ projectId: "p1", search: "boom" });
    expect(f.where).toContain("project_id = ?");
    expect(f.where).toContain("title LIKE ?");
    expect(f.params).toEqual(["p1", "%boom%", "%boom%"]);
  });

  it("expands array state/priority to IN with one placeholder each", () => {
    const q: TaskQuery = { state: ["todo", "blocked"], priority: ["high"] };
    const f = compileToSql(q);
    expect(f.where).toContain("state IN (?, ?)");
    expect(f.where).toContain("priority IN (?)");
    expect(f.params).toEqual(["todo", "blocked", "high"]);
  });

  it("null assignee -> IS NULL with no param", () => {
    const f = compileToSql({ assigneeId: null });
    expect(f.where).toBe("assignee_id IS NULL");
    expect(f.params).toEqual([]);
  });

  it("labels compile to an EXISTS join sub-select", () => {
    const f = compileToSql({ labels: ["a", "b"] });
    expect(f.where).toMatch(/EXISTS \(SELECT 1 FROM task_labels/);
    expect(f.where).toContain("IN (?, ?)");
    expect(f.params).toEqual(["a", "b"]);
  });

  it("combines multiple conditions with AND", () => {
    const f = compileToSql({
      projectId: "p1",
      state: "todo",
      dueBefore: "2026-07-01",
    });
    expect(f.where.split(" AND ").length).toBeGreaterThanOrEqual(3);
    expect(f.params).toEqual(["p1", "todo", "2026-07-01"]);
  });

  it("the number of '?' placeholders equals params length", () => {
    const f = compileToSql({
      projectId: "p1",
      state: ["todo", "blocked"],
      priority: ["high", "urgent"],
      assigneeId: "u1",
      labels: ["x"],
      search: "q",
      dueBefore: "2026-07-01",
      dueAfter: "2026-01-01",
    });
    const placeholders = (f.where.match(/\?/g) ?? []).length;
    expect(placeholders).toBe(f.params.length);
  });
});

describe("query-dsl: round-trip parse -> toTaskQuery -> compileToSql", () => {
  it("produces a parameterized fragment from a raw search string", () => {
    const f = compileToSql(
      toTaskQuery(parseQuery("state:todo,blocked priority:urgent assignee:none")),
    );
    expect(f.where).toContain("state IN (?, ?)");
    expect(f.where).toContain("priority IN (?)");
    expect(f.where).toContain("assignee_id IS NULL");
    expect(f.params).toEqual(["todo", "blocked", "urgent"]);
  });
});
