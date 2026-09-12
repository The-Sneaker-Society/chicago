/**
 * SCAFFOLD — teaching example, not wired to any resolver yet.
 *
 * Frozen vocabularies for the groups domain. Services throw these codes,
 * resolvers translate them to human sentences. Never change a persisted
 * string value without a data migration.
 */

export const groupErrors = Object.freeze({
  notFound: "GROUP_NOT_FOUND",
  forbidden: "FORBIDDEN",
  nameRequired: "GROUP_NAME_REQUIRED",
  nameEmpty: "GROUP_NAME_EMPTY",
  creatorMustRemainMember: "CREATOR_MUST_REMAIN_MEMBER",
  creatorCannotLeave: "CREATOR_CANNOT_LEAVE",
  notAMember: "NOT_A_MEMBER",
  alreadyMember: "ALREADY_A_MEMBER",
});
