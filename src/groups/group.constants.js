/**
 * SCAFFOLD — teaching example, not wired to any resolver yet.
 *
 * Services throw these codes; resolvers translate them to human sentences.
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
  creatorCannotRemoveSelfAsAdmin: "CREATOR_CANNOT_REMOVE_SELF_AS_ADMIN",
  creatorMustRemainAdmin: "CREATOR_MUST_REMAIN_ADMIN",
  creatorCannotBeRemoved: "CREATOR_CANNOT_BE_REMOVED",
});
