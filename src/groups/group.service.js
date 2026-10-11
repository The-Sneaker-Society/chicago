import { groupRepository } from "./group.repository.js";
import { groupErrors } from "./group.constants.js";
import { groupPostRepository } from "../group-posts/groupPost.repository.js";

/**
 * SCAFFOLD — teaching example, not wired to any resolver yet.
 *
 * Business logic + domain errors live here. Notice what this file does NOT do:
 *   - no `ctx` — services take plain values like `memberId` (string).
 *     AuthN (who is calling?) stays in the resolver via
 *     `getAuthenticatedMemberId(ctx)`; authZ (are they allowed?) lives here.
 *   - no Mongoose models — all DB goes through `groupRepository`.
 *   - no Apollo imports — throws plain `Error(<CODE>)`, resolvers translate.
 *
 * Pure asserts (assertGroupMember/Admin/Creator) are WORKED and ready to use.
 * Mutations below are TODO stubs pointing at the resolver code they replace.
 */

export const groupService = {
  // ---------------------------------------------------------------- asserts
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

  assertGroupAdmin(group, memberId) {
    // Replaces: isGroupCreator/isGroupAdmin checks in
    // src/resolvers/group.js:52 (updateGroup), :91 (deleteGroup),
    // src/resolvers/groupPost.js:138-145 (deletePost).
    const isCreator = String(group.createdBy) === String(memberId);
    const isAdmin = (group.admins || []).some(
      (id) => String(id) === String(memberId),
    );
    if (!isCreator && !isAdmin) {
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

  // ------------------------------------------------------------------ reads
  async getGroup(id) {
    return await groupRepository.findByIdPopulated(id);
  },

  async getGroups() {
    return await groupRepository.findAll();
  },

  async getGroupsForUser(userId) {
    return await groupRepository.findByMemberId(userId);
  },

  // ------------------------------------------------------- group lifecycle
  async createGroup(memberId, { name, description, avatar, memberIds = [] }) {
    if (!name?.trim()) {
      throw new Error(groupErrors.nameRequired);
    }

    const creatorMemberId = String(memberId);
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

  async updateGroup(memberId, { id, name, description, avatar, memberIds }) {
    const existingGroup = await groupRepository.findById(id);

    if (!existingGroup) {
      throw new Error(groupErrors.notFound);
    }

    groupService.assertGroupAdmin(existingGroup, memberId);

    const updates = {};

    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error(groupErrors.nameEmpty);
      }

      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (avatar !== undefined) {
      updates.avatar = avatar;
    }

    if (memberIds !== undefined) {
      const nextMembers = [...new Set(memberIds.map(String))];
      const creatorId = String(existingGroup.createdBy);

      if (!nextMembers.includes(creatorId)) {
        throw new Error(groupErrors.creatorMustRemainMember);
      }

      updates.members = nextMembers;
    }

    const updatedGroup = await groupRepository.updateById(id, updates);

    if (!updatedGroup) {
      throw new Error(groupErrors.notFound);
    }

    return updatedGroup;
  },

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

  // ------------------------------------------------ membership and admins
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
