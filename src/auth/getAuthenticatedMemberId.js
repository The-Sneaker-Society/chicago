/**
 * Authentication-only helper for the teaching branch.
 *
 * Preserves the existing member-only authentication behavior.
 * Resolver usage switches to main's guard during Exercise 6.
 */
export const getAuthenticatedMemberId = (ctx) => {
  if (ctx.role !== "member" || !ctx.dbUser?._id) {
    throw new Error("Only authenticated members can perform this action.");
  }

  return String(ctx.dbUser._id);
};
