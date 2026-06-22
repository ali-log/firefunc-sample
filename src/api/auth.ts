import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthContext, UserRole } from "../shared/types.js";
import { USER_ROLES } from "../shared/constants.js";
import { config } from "../shared/config.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/** base64url-encode a UTF-8 string. */
function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/** Sign a payload as a compact HS256 JWT. Useful for tests + the dev seed. */
export function signToken(
  ctx: AuthContext,
  secret: string = config.jwtSecret,
): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: ctx.userId, role: ctx.role }),
  );
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Constant-time comparison of two base64url signatures. */
function signaturesMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && (USER_ROLES as readonly string[]).includes(value)
  );
}

/** Extract a bearer token from the Authorization header. */
export function extractToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Verify a token and resolve its auth context, or null if invalid.
 *
 * Accepts an HS256 JWT signed with `config.jwtSecret`. The signature is
 * verified; the payload must carry a `sub` (userId) and a valid `role`.
 */
export function verifyToken(token: string): AuthContext | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];

  const expected = createHmac("sha256", config.jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (!signaturesMatch(sig, expected)) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof decoded !== "object" || decoded === null) return null;

  const obj = decoded as Record<string, unknown>;
  const userId = obj.sub;
  const role = obj.role;
  if (typeof userId !== "string" || userId.length === 0) return null;
  if (!isUserRole(role)) return null;

  return { userId, role };
}

/** Fastify preHandler that attaches `req.auth` when a valid token is present. */
export async function authHook(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractToken(req);
  if (token) {
    const ctx = verifyToken(token);
    if (ctx) req.auth = ctx;
  }
}

/** Whether a role satisfies a minimum required role. */
export function hasRole(role: UserRole, required: UserRole): boolean {
  const order: Record<UserRole, number> = {
    viewer: 0,
    member: 1,
    admin: 2,
    owner: 3,
  };
  return order[role] >= order[required];
}
