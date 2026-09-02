import { ForbiddenError } from "apollo-server-core";

export const ROLES = Object.freeze({
  MEMBER: "member",
  CLIENT: "client",
  ADMIN: "admin",
});

// Internal factory — do not export publicly.
const guard = (predicate, message) => (resolver) =>
  async (parent, args, ctx, info) => {
    if (!predicate(ctx)) {
      throw new ForbiddenError(message);
    }
    return resolver(parent, args, ctx, info);
  };

/** Any authenticated user (Clerk userId + role resolved in context). */
export const requireAuth = guard(
  (ctx) => Boolean(ctx?.userId && ctx?.role),
  "Unauthorized"
);

/** Authenticated AND role === "member" with a provisioned Member row. */
export const requireMember = guard(
  (ctx) => ctx?.role === ROLES.MEMBER && Boolean(ctx?.dbUser),
  "Only authenticated members can perform this action."
);

/** Authenticated AND role === "client" with a provisioned User row. */
export const requireClient = guard(
  (ctx) => ctx?.role === ROLES.CLIENT && Boolean(ctx?.dbUser),
  "Only authenticated clients can perform this action."
);

/**
 * Authenticated AND role === "admin". Admins are staff with no db row,
 * so unlike member/client guards this must NOT check ctx.dbUser.
 */
export const requireAdmin = guard(
  (ctx) => ctx?.role === ROLES.ADMIN,
  "Only admins can perform this action."
);
