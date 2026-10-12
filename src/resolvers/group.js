import { requireAuth, requireMember } from "../auth/guards.js";
import { groupService } from "../groups/group.service.js";
import { groupErrors } from "../groups/group.constants.js";

const translateGroupError = (error, operation) => {
  switch (error.message) {
    case groupErrors.notFound:
      return new Error("Group not found");

    case groupErrors.nameRequired:
      return new Error("Group name is required.");

    case groupErrors.nameEmpty:
      return new Error("Group name cannot be empty.");

    case groupErrors.creatorMustRemainMember:
      return new Error("The group creator must remain a member.");

    case groupErrors.creatorCannotLeave:
      return new Error("The group creator cannot leave the group.");

    case groupErrors.notAMember:
      if (operation === "addGroupAdmin") {
        return new Error(
          "Only a current group member can be promoted to admin.",
        );
      }

      return new Error("That member is not currently in the group.");

    case groupErrors.creatorCannotRemoveSelfAsAdmin:
      return new Error(
        "The group creator cannot remove themselves as an admin.",
      );

    case groupErrors.creatorMustRemainAdmin:
      return new Error("The group creator must remain an admin.");

    case groupErrors.creatorCannotBeRemoved:
      return new Error("The group creator cannot be removed from the group.");

    case groupErrors.forbidden:
      if (operation === "addGroupAdmin" || operation === "removeGroupAdmin") {
        return new Error("Only the group creator can perform this action.");
      }

      return new Error(
        "Only the group creator or an admin can perform this action.",
      );

    default:
      return error;
  }
};

// Authentication and error translation remain in the resolver layer.
const runGroupMutation = async (ctx, operation, execute) => {
  try {
    const memberId = String(ctx.dbUser._id);
    return await execute(memberId);
  } catch (error) {
    throw translateGroupError(error, operation);
  }
};

const Query = {
  getGroup: requireAuth(async (parent, { id }) => {
    return await groupService.getGroup(id);
  }),

  getGroups: requireAuth(async () => {
    return await groupService.getGroups();
  }),

  getGroupsForUser: requireAuth(async (parent, { userId }) => {
    return await groupService.getGroupsForUser(userId);
  }),
};

const Mutation = {
  createGroup: requireMember(async (parent, args, ctx) => {
    return await runGroupMutation(ctx, "createGroup", (memberId) =>
      groupService.createGroup(memberId, args),
    );
  }),

  updateGroup: requireMember(async (parent, args, ctx) => {
    return await runGroupMutation(ctx, "updateGroup", (memberId) =>
      groupService.updateGroup(memberId, args.id, args),
    );
  }),

  deleteGroup: requireMember(async (parent, { id }, ctx) => {
    return await runGroupMutation(ctx, "deleteGroup", (memberId) =>
      groupService.deleteGroup(memberId, id),
    );
  }),

  joinGroup: requireMember(async (parent, { groupId }, ctx) => {
    return await runGroupMutation(ctx, "joinGroup", (memberId) =>
      groupService.joinGroup(memberId, groupId),
    );
  }),

  leaveGroup: requireMember(async (parent, { groupId }, ctx) => {
    return await runGroupMutation(ctx, "leaveGroup", (memberId) =>
      groupService.leaveGroup(memberId, groupId),
    );
  }),

  addGroupAdmin: requireMember(async (parent, args, ctx) => {
    return await runGroupMutation(ctx, "addGroupAdmin", (actingMemberId) =>
      groupService.addGroupAdmin(actingMemberId, args),
    );
  }),

  removeGroupAdmin: requireMember(async (parent, args, ctx) => {
    return await runGroupMutation(ctx, "removeGroupAdmin", (actingMemberId) =>
      groupService.removeGroupAdmin(actingMemberId, args),
    );
  }),

  removeGroupMember: requireMember(async (parent, args, ctx) => {
    return await runGroupMutation(ctx, "removeGroupMember", (actingMemberId) =>
      groupService.removeGroupMember(actingMemberId, args),
    );
  }),
};

export default { Query, Mutation };
