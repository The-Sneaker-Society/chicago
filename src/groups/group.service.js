import { groupPostRepository } from "../group-posts/groupPost.repository.js";
import { groupErrors } from "./group.constants.js";
import { groupRepository } from "./group.repository.js";

export const groupService = {
  /**
   * Preserves the original resolver behavior: a missing id resolves to null
   * rather than throwing, keeping the Query return shape unchanged.
   */
  async getGroup(id) {
    return await groupRepository.findByIdPopulated(id);
  },

  async getGroups() {
    return await groupRepository.findPopulated();
  },

  async getGroupsForUser(userId) {
    return await groupRepository.findByMemberId(userId);
  },

  /**
   * Creates a group with the caller as creator/first admin.
   * The creator is deduped into members; name must be non-empty.
   * Throws domain errors GROUP_NAME_REQUIRED.
   */
  async createGroup(creatorMemberId, input) {
    const { name, description, avatar, memberIds = [] } = input;

    if (!name || !name.trim()) {
      throw new Error("GROUP_NAME_REQUIRED");
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

  /**
   * Asserts the member is the group creator or an admin.
   * Throws domain error FORBIDDEN for resolvers to translate.
   */
  assertGroupAdmin(group, memberId) {
    const isCreator = String(group.createdBy) === memberId;
    const isAdmin = (group.admins || []).some((id) => String(id) === memberId);

    if (!isCreator && !isAdmin) {
      throw new Error("FORBIDDEN");
    }
  },

  /**
   * Updates a group after verifying admin access.
   * Enforces that the creator always remains a member (domain errors
   * FORBIDDEN / GROUP_NAME_EMPTY / CREATOR_MUST_REMAIN_MEMBER).
   */
  async updateGroup(requesterMemberId, id, updates) {
    const existingGroup = await groupRepository.findById(id);
    if (!existingGroup) {
      throw new Error("GROUP_NOT_FOUND");
    }
    this.assertGroupAdmin(existingGroup, requesterMemberId);

    const update = {};

    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        throw new Error("GROUP_NAME_EMPTY");
      }
      update.name = updates.name.trim();
    }

    if (updates.description !== undefined) update.description = updates.description;
    if (updates.avatar !== undefined) update.avatar = updates.avatar;

    if (updates.memberIds !== undefined) {
      const nextMembers = [...new Set(updates.memberIds.map(String))];
      const creatorId = String(existingGroup.createdBy);

      if (!nextMembers.includes(creatorId)) {
        throw new Error("CREATOR_MUST_REMAIN_MEMBER");
      }

      update.members = nextMembers;
    }

    const group = await groupRepository.updateById(id, update);

    if (!group) {
      throw new Error("GROUP_NOT_FOUND");
    }

    return group;
  },

  /**
   * Deletes a group after verifying admin access.
   * Returns whether a document was removed. Domain errors:
   * GROUP_NOT_FOUND / FORBIDDEN.
   */
  async deleteGroup(memberId, id) {
    const group = await groupRepository.findById(id);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    groupService.assertGroupAdmin(group, memberId);

    const deletedGroup = await groupRepository.deleteById(group._id);

    if (!deletedGroup) {
      throw new Error(groupErrors.notFound);
    }

    // Cross-domain data access goes through the post repository,
    // not the post service or its Mongoose model.
    await groupPostRepository.deleteByGroupId(group._id);

    return true;
  },

  assertGroupMember(group, memberId) {
    // Replaces: isGroupMember(group, memberId) + manual `if (!isMember) throw`
    // in src/resolvers/groupPost.js:117-121, :154-158 and
    // src/services/getPostComment.service.js:20-24.
    const isMember = (group.members || []).some(
      (id) => String(id) === String(memberId),
    );
    if (!isMember) {
      throw new Error(groupErrors.forbidden);
    }
  },

  assertGroupCreator(group, memberId) {
    // Replaces: isGroupCreator checks in src/resolvers/group.js:142, :160
    // (addGroupAdmin / removeGroupAdmin).
    if (String(group.createdBy) !== String(memberId)) {
      throw new Error(groupErrors.forbidden);
    }
  },

  async joinGroup(memberId, groupId) {
    const group = await groupRepository.findById(groupId);

    if (!group) {
      throw new Error(groupErrors.notFound);
    }

    // Intentional: groups are open in the current product phase.
    // TODO: add a visibility/join-policy guard when private groups arrive.
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
