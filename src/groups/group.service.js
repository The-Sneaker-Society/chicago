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
  async deleteGroup(requesterMemberId, id) {
    const existingGroup = await groupRepository.findById(id);
    if (!existingGroup) {
      throw new Error("GROUP_NOT_FOUND");
    }
    this.assertGroupAdmin(existingGroup, requesterMemberId);

    const result = await groupRepository.deleteById(id);
    return !!result;
  },
};
