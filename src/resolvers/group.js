import { groupService } from "../groups/group.service.js";
import { requireAuth, requireMember } from "../auth/guards.js";

const translateDomainError = (error) => {
  switch (error.message) {
    case "GROUP_NOT_FOUND":
      return new Error("Group not found");
    case "FORBIDDEN":
      return new Error(
        "Only the group creator or an admin can perform this action.",
      );
    case "GROUP_NAME_REQUIRED":
      return new Error("Group name is required.");
    case "GROUP_NAME_EMPTY":
      return new Error("Group name cannot be empty.");
    case "CREATOR_MUST_REMAIN_MEMBER":
      return new Error("The group creator must remain a member.");
    default:
      return error;
  }
};

// Role auth via guards; ownership (creator/admin) stays in the service.
const Query = {
  getGroup: requireAuth(async (parent, { id }, ctx, info) => {
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
  createGroup: requireMember(async (parent, args, ctx, info) => {
    try {
      const creatorMemberId = String(ctx.dbUser._id);
      return await groupService.createGroup(creatorMemberId, {
        name: args.name,
        description: args.description,
        avatar: args.avatar,
        memberIds: args.memberIds,
      });
    } catch (error) {
      throw translateDomainError(error);
    }
  }),

  updateGroup: requireMember(
    async (parent, { id, name, description, avatar, memberIds }, ctx) => {
      try {
        const requesterMemberId = String(ctx.dbUser._id);
        return await groupService.updateGroup(requesterMemberId, id, {
          name,
          description,
          avatar,
          memberIds,
        });
      } catch (error) {
        throw translateDomainError(error);
      }
    },
  ),

  deleteGroup: requireMember(async (parent, { id }, ctx) => {
    try {
      const requesterMemberId = String(ctx.dbUser._id);
      return await groupService.deleteGroup(requesterMemberId, id);
    } catch (error) {
      throw translateDomainError(error);
    }
  }),
};

export default { Query, Mutation };
