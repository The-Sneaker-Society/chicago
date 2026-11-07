import { groupPostRepository } from "../group-posts/groupPost.repository.js";
import { groupErrors } from "./group.constants.js";
import { groupRepository } from "./group.repository.js";

export const groupService = {
  async getGroup(id) {
    return await groupRepository.findByIdPopulated(id);
  },

  async getGroups() {
    return await groupRepository.findPopulated();
  },

  async getGroupsForUser(userId) {
    return await groupRepository.findByMemberId(userId);
  },

  async createGroup(creatorMemberId, input) {
    const { name, description, avatar, memberIds = [] } = input;

    if (!name || !name.trim()) {
      throw new Error(groupErrors.nameRequired);
    }

    const members = [...new Set([creatorMemberId, ...memberIds.map(String)])];

    return await groupRepository.create({
      name: name.trim(),
      description,
      avatar,
      members,
      createdBy: creatorMemberId,
      admins: [creatorMemberId],
    });
  },

  assertGroupAdmin(group, memberId) {
    const isCreator = String(group.createdBy) === memberId;
    const isAdmin = (group.admins || []).some((id) => String(id) === memberId);

    if (!isCreator && !isAdmin) {
      throw new Error(groupErrors.forbidden);
    }
  },

  async updateGroup(requesterMemberId, id, updates) {
    const existingGroup = await groupRepository.findById(id);
    if (!existingGroup) {
      throw new Error(groupErrors.notFound);
    }
    this.assertGroupAdmin(existingGroup, requesterMemberId);

    const update = {};

    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        throw new Error(groupErrors.nameEmpty);
      }
      update.name = updates.name.trim();
    }

    if (updates.description !== undefined)
      update.description = updates.description;
    if (updates.avatar !== undefined) update.avatar = updates.avatar;

    if (updates.memberIds !== undefined) {
      const nextMembers = [...new Set(updates.memberIds.map(String))];
      const creatorId = String(existingGroup.createdBy);

      if (!nextMembers.includes(creatorId)) {
        throw new Error(groupErrors.creatorMustRemainMember);
      }

      update.members = nextMembers;
    }

    const group = await groupRepository.updateById(id, update);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    return group;
  },

  async deleteGroup(memberId, id) {
    const group = await groupRepository.findById(id);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    groupService.assertGroupAdmin(group, memberId);

    await groupPostRepository.deleteByGroupId(group._id);

    const deletedGroup = await groupRepository.deleteById(group._id);

    if (!deletedGroup) {
      throw new Error(groupErrors.notFound);
    }

    return true;
  },

  assertGroupMember(group, memberId) {
    const isMember = (group.members || []).some(
      (id) => String(id) === String(memberId),
    );
    if (!isMember) {
      throw new Error(groupErrors.forbidden);
    }
  },

  assertGroupCreator(group, memberId) {
    if (String(group.createdBy) !== String(memberId)) {
      throw new Error(groupErrors.forbidden);
    }
  },

  async joinGroup(memberId, groupId) {
    const group = await groupRepository.findById(groupId);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    const updatedGroup = await groupRepository.addMember(
      groupId,
      String(memberId),
    );

    if (!updatedGroup) {
      throw new Error(groupErrors.notFound);
    }

    return updatedGroup;
  },

  async leaveGroup(memberId, groupId) {
    const group = await groupRepository.findById(groupId);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    if (String(group.createdBy) === String(memberId)) {
      throw new Error(groupErrors.creatorCannotLeave);
    }

    const updatedGroup = await groupRepository.pullMember(
      groupId,
      String(memberId),
    );

    if (!updatedGroup) {
      throw new Error(groupErrors.notFound);
    }

    return updatedGroup;
  },

  async addGroupAdmin(actingMemberId, { groupId, memberId }) {
    const group = await groupRepository.findById(groupId);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    groupService.assertGroupCreator(group, actingMemberId);

    const normalizedMemberId = String(memberId);
    const isMember = (group.members || []).some(
      (id) => String(id) === normalizedMemberId,
    );

    if (!isMember) {
      throw new Error(groupErrors.notAMember);
    }

    const updatedGroup = await groupRepository.addAdmin(
      groupId,
      normalizedMemberId,
    );

    if (!updatedGroup) {
      throw new Error(groupErrors.notFound);
    }

    return updatedGroup;
  },

  async removeGroupAdmin(actingMemberId, { groupId, memberId }) {
    const group = await groupRepository.findById(groupId);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    groupService.assertGroupCreator(group, actingMemberId);

    const normalizedMemberId = String(memberId);

    if (normalizedMemberId === String(actingMemberId)) {
      throw new Error(groupErrors.creatorCannotRemoveSelfAsAdmin);
    }

    if (String(group.createdBy) === normalizedMemberId) {
      throw new Error(groupErrors.creatorMustRemainAdmin);
    }

    const updatedGroup = await groupRepository.pullAdmin(
      groupId,
      normalizedMemberId,
    );

    if (!updatedGroup) {
      throw new Error(groupErrors.notFound);
    }

    return updatedGroup;
  },

  async removeGroupMember(actingMemberId, { groupId, memberId }) {
    const group = await groupRepository.findById(groupId);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    groupService.assertGroupAdmin(group, actingMemberId);

    const normalizedMemberId = String(memberId);

    if (String(group.createdBy) === normalizedMemberId) {
      throw new Error(groupErrors.creatorCannotBeRemoved);
    }

    const isMember = (group.members || []).some(
      (id) => String(id) === normalizedMemberId,
    );

    if (!isMember) {
      throw new Error(groupErrors.notAMember);
    }

    const updatedGroup = await groupRepository.pullMember(
      groupId,
      normalizedMemberId,
    );

    if (!updatedGroup) {
      throw new Error(groupErrors.notFound);
    }

    return updatedGroup;
  },
};
