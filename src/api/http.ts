import type { FastifyReply, FastifyRequest } from "fastify";
import { z, type ZodError, type ZodTypeAny } from "zod";
import type { ApiError, AuthContext } from "../shared/types.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../shared/constants.js";

/** Build a structured ApiError body. */
export function apiError(
  statusCode: number,
  error: string,
  message: string,
  details?: unknown,
): ApiError {
  const body: ApiError = { error, message, statusCode };
  if (details !== undefined) body.details = details;
  return body;
}

/** Send a structured error response and return the reply (for `return`). */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
  details?: unknown,
): FastifyReply {
  return reply.code(statusCode).send(apiError(statusCode, error, message, details));
}

/** 404 helper. */
export function notFound(reply: FastifyReply, message: string): FastifyReply {
  return sendError(reply, 404, "not_found", message);
}

/**
 * Require an authenticated request. Returns the AuthContext, or sends a 401 and
 * returns null. Callers must `return reply` when this yields null.
 */
export function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): AuthContext | null {
  if (!req.auth) {
    sendError(reply, 401, "unauthorized", "authentication required");
    return null;
  }
  return req.auth;
}

/**
 * Validate `data` against a zod schema. On success returns the parsed value; on
 * failure sends a 400 with flattened issues and returns the `INVALID` sentinel.
 * Callers check `result === INVALID` and `return reply`.
 */
export const INVALID = Symbol("invalid");

export function validate<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
  reply: FastifyReply,
): z.infer<S> | typeof INVALID {
  const result = schema.safeParse(data);
  if (!result.success) {
    sendError(
      reply,
      400,
      "validation_error",
      "request validation failed",
      flattenZod(result.error),
    );
    return INVALID;
  }
  return result.data;
}

function flattenZod(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

/** Shared pagination query schema → { limit, offset }. */
export const paginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});
