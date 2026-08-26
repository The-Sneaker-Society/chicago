import GroupsModel from "../models/Groups.model";
import GroupPostModel from "../models/GroupPost.model";
import {
  requireAuthenticatedMember,
  requireGroupCreatorAccess,
  requireGroupAdminAccess,
} from "../utils/groupPermissions";
import { getPopulatedGroup } from "../utils/groupQueries";

const Query = {
  async getGroup(parent, { id }) {
    return getPopulatedGroup(id);
  },

  async getGroups() {
    return GroupsModel.find({})
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },

  async getGroupsForUser(parent, { userId }) {
    return GroupsModel.find({ members: userId })
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },
};

const Mutation = {
  async createGroup(parent, args, ctx) {
    const { name, description, avatar, memberIds = [] } = args;

    if (!name?.trim()) {
      throw new Error("Group name is required.");
    }

    const creatorMemberId = requireAuthenticatedMember(ctx);
    const members = [...new Set([creatorMemberId, ...memberIds.map(String)])];

    const newGroup = new GroupsModel({
      name: name.trim(),
      description,
      avatar,
      members,
      createdBy: creatorMemberId,
      admins: [creatorMemberId],
    });

    const saved = await newGroup.save();
    return getPopulatedGroup(saved._id);
  },

  async updateGroup(parent, { id, name, description, avatar, memberIds }, ctx) {
    const { group: existingGroup } = await requireGroupAdminAccess(id, ctx);
    const update = {};

    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error("Group name cannot be empty.");
      }
      update.name = name.trim();
    }

    if (description !== undefined) update.description = description;
    if (avatar !== undefined) update.avatar = avatar;

    if (memberIds !== undefined) {
      const nextMembers = [...new Set(memberIds.map(String))];
      const creatorId = String(existingGroup.createdBy);

      if (!nextMembers.includes(creatorId)) {
        throw new Error("The group creator must remain a member.");
      }

      update.members = nextMembers;
    }

    const group = await GroupsModel.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!group) {
      throw new Error("Group not found");
    }

    return getPopulatedGroup(group._id);
  },

  async deleteGroup(parent, { id }, ctx) {
    const { group } = await requireGroupAdminAccess(id, ctx);
    const deletedGroup = await GroupsModel.findByIdAndDelete(group._id);

    if (!deletedGroup) {
      throw new Error("Group not found");
    }

    await GroupPostModel.deleteMany({ groupId: group._id });
    return true;
  },

  async joinGroup(parent, { groupId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    // Intentional: groups are open in the current product phase.
    // Add a visibility/join-policy guard here when private groups are introduced.
    const group = await GroupsModel.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: memberId } },
      { new: true },
    );

    if (!group) {
      throw new Error("Group not found");
    }

    return getPopulatedGroup(group._id);
  },

  async leaveGroup(parent, { groupId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const group = await GroupsModel.findById(groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    if (String(group.createdBy) === memberId) {
      throw new Error("The group creator cannot leave the group.");
    }

    const updated = await GroupsModel.findByIdAndUpdate(
      groupId,
      { $pull: { members: memberId, admins: memberId } },
      { new: true },
    );

    return getPopulatedGroup(updated._id);
  },

  async addGroupAdmin(parent, { groupId, memberId }, ctx) {
    const { group } = await requireGroupCreatorAccess(groupId, ctx);
    const normalizedMemberId = String(memberId);
    const isMember = (group.members || []).some(
      (id) => String(id) === normalizedMemberId,
    );

    if (!isMember) {
      throw new Error("Only a current group member can be promoted to admin.");
    }

    await GroupsModel.findByIdAndUpdate(groupId, {
      $addToSet: { admins: normalizedMemberId },
    });

    return getPopulatedGroup(groupId);
  },

  async removeGroupAdmin(parent, { groupId, memberId }, ctx) {
    const { group, memberId: actingMemberId } = await requireGroupCreatorAccess(
      groupId,
      ctx,
    );
    const normalizedMemberId = String(memberId);

    if (normalizedMemberId === actingMemberId) {
      throw new Error(
        "The group creator cannot remove themselves as an admin.",
      );
    }

    if (String(group.createdBy) === normalizedMemberId) {
      throw new Error("The group creator must remain an admin.");
    }

    await GroupsModel.findByIdAndUpdate(groupId, {
      $pull: { admins: normalizedMemberId },
    });

    return getPopulatedGroup(groupId);
  },

  async removeGroupMember(parent, { groupId, memberId }, ctx) {
    const { group } = await requireGroupAdminAccess(groupId, ctx);
    const normalizedMemberId = String(memberId);

    if (String(group.createdBy) === normalizedMemberId) {
      throw new Error("The group creator cannot be removed from the group.");
    }

    const isMember = (group.members || []).some(
      (id) => String(id) === normalizedMemberId,
    );

    if (!isMember) {
      throw new Error("That member is not currently in the group.");
    }

    await GroupsModel.findByIdAndUpdate(groupId, {
      $pull: {
        members: normalizedMemberId,
        admins: normalizedMemberId,
      },
    });

    return getPopulatedGroup(groupId);
  },
};

export default { Query, Mutation };
