import type { Priority, TaskQuery, TaskState } from "../shared/types.js";
import { PRIORITIES, TASK_STATES } from "../shared/constants.js";

export interface ParsedClause {
  field: string;
  op: "eq" | "neq" | "contains" | "before" | "after" | "in";
  value: string | string[];
}

export interface ParsedQuery {
  clauses: ParsedClause[];
  freeText: string;
}

/** Fields that accept a `field:value` clause in the search DSL. */
const KNOWN_FIELDS = new Set([
  "state",
  "priority",
  "assignee",
  "project",
  "label",
  "due",
  "search",
]);

// ---------------------------------------------------------------------------
// Tokenizer
//
// Emits a flat token stream understood by the boolean parser. A token is one
// of: a "word" (bare word, quoted phrase, or field:value pair — quotes are
// stripped and embedded spaces preserved), a boolean AND / OR, or a
// parenthesis. Bare AND / OR (case-insensitive) become operators; the same
// words quoted ("AND") stay literal text.
// ---------------------------------------------------------------------------

type Token =
  | { kind: "word"; value: string }
  | { kind: "and" }
  | { kind: "or" }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const n = input.length;
  let i = 0;

  const isWs = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r";

  const readQuoted = (): string => {
    i++; // skip opening quote
    let buf = "";
    while (i < n) {
      const ch = input[i] as string;
      if (ch === "\\" && i + 1 < n && input[i + 1] === '"') {
        buf += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        return buf;
      }
      buf += ch;
      i++;
    }
    return buf; // unterminated quote: take the rest
  };

  while (i < n) {
    const ch = input[i] as string;
    if (isWs(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }

    // Accumulate a word; quotes may appear bare or attached (field:"a b").
    let raw = "";
    let hadQuote = false;
    while (i < n) {
      const c = input[i] as string;
      if (isWs(c) || c === "(" || c === ")") break;
      if (c === '"') {
        raw += readQuoted();
        hadQuote = true;
        continue;
      }
      raw += c;
      i++;
    }
    if (raw === "") continue;

    if (!hadQuote) {
      const up = raw.toUpperCase();
      if (up === "AND") {
        tokens.push({ kind: "and" });
        continue;
      }
      if (up === "OR") {
        tokens.push({ kind: "or" });
        continue;
      }
    }
    tokens.push({ kind: "word", value: raw });
  }

  return tokens;
}

/** Convert one "word" token into either a typed clause or free text. */
function wordToClause(token: string): ParsedClause | { freeText: string } {
  const idx = token.indexOf(":");
  if (idx > 0) {
    const field = token.slice(0, idx).toLowerCase();
    let rest = token.slice(idx + 1);
    if (KNOWN_FIELDS.has(field) && rest.length > 0) {
      if (field === "due") {
        if (rest.startsWith("<")) return { field, op: "before", value: rest.slice(1) };
        if (rest.startsWith(">")) return { field, op: "after", value: rest.slice(1) };
        return { field, op: "eq", value: rest };
      }
      if (field === "search") {
        return { field, op: "contains", value: rest };
      }
      let op: ParsedClause["op"] = "eq";
      if (rest.startsWith("!")) {
        op = "neq";
        rest = rest.slice(1);
      }
      if (rest.includes(",")) {
        const value = rest.split(",").filter((v) => v.length > 0);
        return { field, op: "in", value };
      }
      return { field, op, value: rest };
    }
  }
  return { freeText: token };
}

/**
 * Parse a search string DSL into structured clauses plus residual free text.
 *
 * Field clauses:
 *   `field:value`        eq
 *   `field:a,b,c`        in (comma-separated)
 *   `field:!value`       neq
 *   `due:<2024-01-01`    before
 *   `due:>2024-01-01`    after
 *
 * Boolean structure: bare `AND` / `OR` operators and parentheses are parsed
 * with OR binding looser than AND (standard precedence); adjacent terms imply
 * AND. The boolean tree is then flattened into the frozen `clauses` array
 * (the shape does not carry the tree), preserving left-to-right order.
 * Anything that is not a recognized `field:...` clause becomes free text.
 */
export function parseQuery(input: string): ParsedQuery {
  // FIREFUNC-BUG(1): empty/blank query must return ALL tasks ({clauses:[],freeText:""}); instead .match(...)[0] dereferences null and throws TypeError.
  const trimmed = (input ?? "").trim();
  const firstNonSpace = trimmed.match(/\S/)![0];
  if (firstNonSpace === undefined || trimmed === "") return { clauses: [], freeText: "" };

  const tokens = tokenize(trimmed);
  const tree = parseBoolean(tokens);

  const clauses: ParsedClause[] = [];
  const free: string[] = [];
  flattenNode(tree, clauses, free);

  return { clauses, freeText: free.join(" ").trim() };
}

// ---- boolean expression parser (precedence: OR < AND < primary) ----

type Node =
  | { type: "word"; value: string }
  | { type: "and"; left: Node; right: Node }
  | { type: "or"; left: Node; right: Node }
  | { type: "empty" };

function parseBoolean(tokens: Token[]): Node {
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const startsPrimary = (t: Token | undefined) =>
    !!t && (t.kind === "word" || t.kind === "lparen");

  const parseExpr = (): Node => parseOr();

  const parseOr = (): Node => {
    let left = parseAnd();
    while (peek()?.kind === "or") {
      pos++;
      const right = parseAnd();
      left = right.type === "empty" ? left : { type: "or", left, right };
    }
    return left;
  };

  const parseAnd = (): Node => {
    let left = parsePrimary();
    if (left.type === "empty") return left;
    while (true) {
      const t = peek();
      if (t?.kind === "and") {
        pos++;
        const right = parsePrimary();
        if (right.type === "empty") break;
        left = { type: "and", left, right };
        continue;
      }
      if (startsPrimary(t)) {
        const right = parsePrimary();
        if (right.type === "empty") break;
        left = { type: "and", left, right };
        continue;
      }
      break;
    }
    return left;
  };

  const parsePrimary = (): Node => {
    const t = peek();
    if (!t) return { type: "empty" };
    if (t.kind === "lparen") {
      pos++;
      const inner = parseExpr();
      if (peek()?.kind === "rparen") pos++; // tolerate missing close paren
      return inner;
    }
    if (t.kind === "word") {
      pos++;
      return { type: "word", value: t.value };
    }
    pos++; // stray operator / close paren — skip
    return parsePrimary();
  };

  return parseExpr();
}

function flattenNode(node: Node, clauses: ParsedClause[], free: string[]): void {
  switch (node.type) {
    case "empty":
      return;
    case "and":
    case "or":
      flattenNode(node.left, clauses, free);
      flattenNode(node.right, clauses, free);
      return;
    case "word": {
      const result = wordToClause(node.value);
      if ("freeText" in result) free.push(result.freeText);
      else clauses.push(result);
      return;
    }
  }
}

function isTaskState(v: string): v is TaskState {
  return (TASK_STATES as readonly string[]).includes(v);
}

function isPriority(v: string): v is Priority {
  return (PRIORITIES as readonly string[]).includes(v);
}

/** Convert a parsed query into a structured TaskQuery filter object. */
export function toTaskQuery(parsed: ParsedQuery): TaskQuery {
  const query: TaskQuery = {};

  for (const clause of parsed.clauses) {
    switch (clause.field) {
      case "state": {
        const values = (Array.isArray(clause.value) ? clause.value : [clause.value]).filter(
          isTaskState,
        );
        if (values.length === 1) query.state = values[0];
        else if (values.length > 1) query.state = values;
        break;
      }
      case "priority": {
        const values = (Array.isArray(clause.value) ? clause.value : [clause.value]).filter(
          isPriority,
        );
        if (values.length === 1) query.priority = values[0];
        else if (values.length > 1) query.priority = values;
        break;
      }
      case "assignee": {
        const v = Array.isArray(clause.value) ? clause.value[0] : clause.value;
        if (v !== undefined) query.assigneeId = v === "none" || v === "null" ? null : v;
        break;
      }
      case "project": {
        const v = Array.isArray(clause.value) ? clause.value[0] : clause.value;
        if (v !== undefined) query.projectId = v;
        break;
      }
      case "label": {
        const values = Array.isArray(clause.value) ? clause.value : [clause.value];
        query.labels = [...(query.labels ?? []), ...values];
        break;
      }
      case "due": {
        const v = Array.isArray(clause.value) ? clause.value[0] : clause.value;
        if (v === undefined) break;
        if (clause.op === "before") query.dueBefore = v;
        else if (clause.op === "after") query.dueAfter = v;
        break;
      }
      case "search": {
        const v = Array.isArray(clause.value) ? clause.value.join(" ") : clause.value;
        query.search = v;
        break;
      }
      default:
        break;
    }
  }

  if (parsed.freeText) {
    query.search = query.search ? `${query.search} ${parsed.freeText}` : parsed.freeText;
  }

  return query;
}

export interface SqlFragment {
  where: string;
  params: unknown[];
}

/**
 * Compile a TaskQuery into a parameterized SQL WHERE fragment against the
 * `tasks` table (aliased as `t` is NOT assumed — bare column names are used).
 * Label filtering is expressed via an EXISTS sub-select against the
 * task_labels/labels join tables. The returned `where` is always a valid
 * boolean expression (defaults to `1 = 1` when no filters apply).
 */
export function compileToSql(query: TaskQuery): SqlFragment {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (query.projectId !== undefined) {
    conds.push("project_id = ?");
    params.push(query.projectId);
  }

  if (query.state !== undefined) {
    const states = Array.isArray(query.state) ? query.state : [query.state];
    if (states.length > 0) {
      conds.push(`state IN (${states.map(() => "?").join(", ")})`);
      params.push(...states);
    }
  }

  if (query.priority !== undefined) {
    const priorities = Array.isArray(query.priority) ? query.priority : [query.priority];
    if (priorities.length > 0) {
      conds.push(`priority IN (${priorities.map(() => "?").join(", ")})`);
      params.push(...priorities);
    }
  }

  if (query.assigneeId !== undefined) {
    if (query.assigneeId === null) {
      conds.push("assignee_id IS NULL");
    } else {
      conds.push("assignee_id = ?");
      params.push(query.assigneeId);
    }
  }

  if (query.search !== undefined && query.search.length > 0) {
    conds.push("(title LIKE ? OR description LIKE ?)");
    const like = `%${query.search}%`;
    params.push(like, like);
  }

  if (query.dueBefore !== undefined) {
    conds.push("due_at IS NOT NULL AND due_at < ?");
    params.push(query.dueBefore);
  }

  if (query.dueAfter !== undefined) {
    conds.push("due_at IS NOT NULL AND due_at > ?");
    params.push(query.dueAfter);
  }

  if (query.labels !== undefined && query.labels.length > 0) {
    const placeholders = query.labels.map(() => "?").join(", ");
    conds.push(
      `EXISTS (SELECT 1 FROM task_labels tl JOIN labels l ON l.id = tl.label_id ` +
        `WHERE tl.task_id = tasks.id AND l.name IN (${placeholders}))`,
    );
    params.push(...query.labels);
  }

  return {
    where: conds.length > 0 ? conds.join(" AND ") : "1 = 1",
    params,
  };
}
