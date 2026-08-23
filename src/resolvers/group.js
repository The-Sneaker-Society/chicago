import { groupService } from "../groups/group.service.js";

const requireAuthenticatedMember = (ctx) => {
  if (ctx.role !== "member" || !ctx.dbUser?._id) {
    throw new Error("Only authenticated members can perform this action.");
  }

  return String(ctx.dbUser._id);
};

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

const Query = {
  async getGroup(parent, { id }, ctx, info) {
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
  async createGroup(parent, args, ctx, info) {
    try {
      const creatorMemberId = requireAuthenticatedMember(ctx);
      return await groupService.createGroup(creatorMemberId, {
        name: args.name,
        description: args.description,
        avatar: args.avatar,
        memberIds: args.memberIds,
      });
    } catch (error) {
      throw translateDomainError(error);
    }
  },

  async updateGroup(parent, { id, name, description, avatar, memberIds }, ctx) {
    try {
      const requesterMemberId = requireAuthenticatedMember(ctx);
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

  async deleteGroup(parent, { id }, ctx) {
    try {
      const requesterMemberId = requireAuthenticatedMember(ctx);
      return await groupService.deleteGroup(requesterMemberId, id);
    } catch (error) {
      throw translateDomainError(error);
    }
  },
};

export default { Query, Mutation };
