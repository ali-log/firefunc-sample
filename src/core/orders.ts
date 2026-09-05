/**
 * Orders domain — a minimal, in-memory order lifecycle with an append-only
 * status-change history.
 *
 * An order moves through a small set of statuses. Every transition is recorded
 * as a `{ status, at }` entry appended to the order's history, so the full
 * timeline (with timestamps) can be read back via {@link getOrderHistory}. The
 * two recording points are {@link placeOrder} (initial `placed`) and
 * {@link cancelOrder} (`cancelled`).
 *
 * History order is defined by insertion order (append-only), NOT by sorting on
 * `at`: two changes recorded within the same millisecond carry equal timestamps
 * but remain correctly ordered by position.
 *
 * The store is process-local (an in-memory Map); it is not persisted and resets
 * on restart. That keeps this feature self-contained and avoids a schema
 * migration.
 */
import { randomUUID } from "node:crypto";
import type { ID, ISODateString } from "../shared/types.js";

export type OrderStatus = "placed" | "cancelled";

export interface OrderStatusChange {
  status: OrderStatus;
  /** Wall-clock time the change was recorded (ISO-8601). */
  at: ISODateString;
}

export interface Order {
  id: ID;
  status: OrderStatus;
  /** Append-ordered status changes, each timestamped. */
  history: OrderStatusChange[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// In-memory store keyed by order id.
const orders = new Map<ID, Order>();

function nowIso(): ISODateString {
  return new Date().toISOString();
}

/** Append a timestamped status change and sync the order's current status. */
function recordStatusChange(
  order: Order,
  status: OrderStatus,
  at: ISODateString,
): void {
  order.history.push({ status, at });
  order.status = status;
  order.updatedAt = at;
}

/**
 * Place a new order. Creates it in the `placed` status and records that as the
 * first entry in its history.
 */
export function placeOrder(): Order {
  const at = nowIso();
  const order: Order = {
    id: randomUUID(),
    status: "placed",
    history: [],
    createdAt: at,
    updatedAt: at,
  };
  recordStatusChange(order, "placed", at);
  orders.set(order.id, order);
  return order;
}

/**
 * Cancel an existing order. Moves it to the `cancelled` status and records that
 * change with a timestamp. Returns the order, or `null` if no such order
 * exists. Already-cancelled orders are left unchanged (no duplicate entry).
 */
export function cancelOrder(id: ID): Order | null {
  const order = orders.get(id);
  if (!order) return null;
  if (order.status !== "cancelled") {
    recordStatusChange(order, "cancelled", nowIso());
  }
  return order;
}

/** Look up an order by id, or `undefined` if it does not exist. */
export function getOrder(id: ID): Order | undefined {
  return orders.get(id);
}

/**
 * The order's status-change history (append-ordered, each entry timestamped),
 * or `undefined` if the order does not exist.
 */
export function getOrderHistory(id: ID): OrderStatusChange[] | undefined {
  return orders.get(id)?.history;
}

/** Clear all orders. Intended for test isolation. */
export function resetOrders(): void {
  orders.clear();
}
