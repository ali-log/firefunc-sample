import type { FastifyInstance } from "fastify";
import { cancelOrder, getOrder, placeOrder } from "../../core/orders.js";
import { notFound, requireAuth, sendError } from "../http.js";

/**
 * Register order lifecycle + history routes under /api/orders.
 *
 * The order's status changes are recorded (with timestamps) inside
 * `placeOrder`/`cancelOrder`; the history endpoint just reads them back.
 */
export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/orders — place a new order (records a "placed" status change).
  app.post("/api/orders", async (req, reply) => {
    const auth = requireAuth(req, reply);
    if (!auth) return reply;

    const order = placeOrder();
    return reply.code(201).send(order);
  });

  // POST /api/orders/:id/cancel — cancel an order (records a "cancelled" change).
  app.post<{ Params: { id: string } }>(
    "/api/orders/:id/cancel",
    async (req, reply) => {
      const auth = requireAuth(req, reply);
      if (!auth) return reply;

      const existing = getOrder(req.params.id);
      if (!existing) return notFound(reply, "order not found");
      if (existing.status === "cancelled") {
        return sendError(
          reply,
          409,
          "illegal_transition",
          "order is already cancelled",
        );
      }

      return cancelOrder(req.params.id);
    },
  );

  // GET /api/orders/:id/history — the order's status changes with timestamps.
  app.get<{ Params: { id: string } }>(
    "/api/orders/:id/history",
    async (req, reply) => {
      const order = getOrder(req.params.id);
      if (!order) return notFound(reply, "order not found");
      return { orderId: order.id, history: order.history };
    },
  );
}
