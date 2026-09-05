import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { useTempDatabase } from "./helpers.js";

const db = useTempDatabase();

let app: FastifyInstance;
let token: string;
let resetOrders: () => void;

const authHeaders = () => ({ authorization: `Bearer ${token}` });

const placeOrder = () =>
  app.inject({ method: "POST", url: "/api/orders", headers: authHeaders() });

const cancelOrder = (id: string) =>
  app.inject({
    method: "POST",
    url: `/api/orders/${id}/cancel`,
    headers: authHeaders(),
  });

const getHistory = (id: string) =>
  app.inject({ method: "GET", url: `/api/orders/${id}/history` });

const isIsoDate = (v: unknown): boolean =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));

beforeAll(async () => {
  const { buildServer } = await import("../src/api/server.js");
  const { signToken } = await import("../src/api/auth.js");
  ({ resetOrders } = await import("../src/core/orders.js"));
  app = await buildServer();
  await app.ready();
  token = signToken({ userId: "admin", role: "admin" });
});

beforeEach(() => {
  resetOrders();
});

afterAll(async () => {
  await app.close();
  db.cleanup();
});

describe("orders API — status history", () => {
  it("records a 'placed' change when an order is placed", async () => {
    const res = await placeOrder();
    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order.id).toBeTruthy();
    expect(order.status).toBe("placed");
    expect(order.history).toHaveLength(1);
    expect(order.history[0].status).toBe("placed");
    expect(isIsoDate(order.history[0].at)).toBe(true);
  });

  it("records placed → cancelled changes with timestamps, readable via /history", async () => {
    const id = (await placeOrder()).json().id;

    const cancelled = await cancelOrder(id);
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().status).toBe("cancelled");

    const res = await getHistory(id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.orderId).toBe(id);

    const history = body.history;
    expect(history).toHaveLength(2);
    expect(history.map((h: { status: string }) => h.status)).toEqual([
      "placed",
      "cancelled",
    ]);

    // Every entry carries a valid ISO timestamp.
    for (const entry of history) {
      expect(isIsoDate(entry.at)).toBe(true);
    }

    // Chronological, but only non-decreasing: two changes can land in the same
    // millisecond, so we must NOT assume strictly increasing timestamps.
    expect(Date.parse(history[1].at)).toBeGreaterThanOrEqual(
      Date.parse(history[0].at),
    );
  });

  it("returns 404 for the history of an unknown order", async () => {
    const res = await getHistory("does-not-exist");
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("not_found");
  });

  it("returns 404 when cancelling an unknown order", async () => {
    const res = await cancelOrder("does-not-exist");
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("not_found");
  });

  it("returns 409 when cancelling an already-cancelled order", async () => {
    const id = (await placeOrder()).json().id;
    await cancelOrder(id);

    const again = await cancelOrder(id);
    expect(again.statusCode).toBe(409);

    // The rejected re-cancel must not add a duplicate history entry.
    const history = (await getHistory(id)).json().history;
    expect(history).toHaveLength(2);
  });

  it("requires authentication to place an order", async () => {
    const res = await app.inject({ method: "POST", url: "/api/orders" });
    expect(res.statusCode).toBe(401);
  });
});
