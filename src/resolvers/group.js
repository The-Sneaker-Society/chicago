import { getAuthenticatedMemberId } from "../auth/getAuthenticatedMemberId.js";
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
    const memberId = getAuthenticatedMemberId(ctx);
    return await execute(memberId);
  } catch (error) {
    throw translateGroupError(error, operation);
  }
};

const Query = {
  async getGroup(parent, { id }) {
    return await groupService.getGroup(id);
  },

  async getGroups() {
    return await groupService.getGroups();
  },

  async getGroupsForUser(parent, { userId }) {
    return await groupService.getGroupsForUser(userId);
  },
};

const Mutation = {
  async createGroup(parent, args, ctx) {
    return await runGroupMutation(ctx, "createGroup", (memberId) =>
      groupService.createGroup(memberId, args),
    );
  },

  async updateGroup(parent, args, ctx) {
    return await runGroupMutation(ctx, "updateGroup", (memberId) =>
      groupService.updateGroup(memberId, args),
    );
  },

  async deleteGroup(parent, { id }, ctx) {
    return await runGroupMutation(ctx, "deleteGroup", (memberId) =>
      groupService.deleteGroup(memberId, id),
    );
  },

  async joinGroup(parent, { groupId }, ctx) {
    return await runGroupMutation(ctx, "joinGroup", (memberId) =>
      groupService.joinGroup(memberId, groupId),
    );
  },

  async leaveGroup(parent, { groupId }, ctx) {
    return await runGroupMutation(ctx, "leaveGroup", (memberId) =>
      groupService.leaveGroup(memberId, groupId),
    );
  },

  async addGroupAdmin(parent, args, ctx) {
    return await runGroupMutation(ctx, "addGroupAdmin", (actingMemberId) =>
      groupService.addGroupAdmin(actingMemberId, args),
    );
  },

  async removeGroupAdmin(parent, args, ctx) {
    return await runGroupMutation(ctx, "removeGroupAdmin", (actingMemberId) =>
      groupService.removeGroupAdmin(actingMemberId, args),
    );
  },

  async removeGroupMember(parent, args, ctx) {
    return await runGroupMutation(ctx, "removeGroupMember", (actingMemberId) =>
      groupService.removeGroupMember(actingMemberId, args),
    );
  },
};

export default { Query, Mutation };
