import { groupRepository } from "./group.repository.js";
import { groupErrors } from "./group.constants.js";

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

  // --------------------------------------------------------------- mutations
  // TODO(exercise 4): port src/resolvers/group.js:102 joinGroup here.
  //   Signature: async joinGroup(memberId, groupId)
  //   Steps: findById -> GROUP_NOT_FOUND; $addToSet via repo.addMember.
  //   Keep the open-join comment as a TODO stub for the future join-policy.
  async joinGroup(memberId, groupId) {
    throw new Error("TODO(joinGroup): port from src/resolvers/group.js:102");
  },

  // TODO(exercise 4): port src/resolvers/group.js:120 leaveGroup here.
  //   Signature: async leaveGroup(memberId, groupId)
  //   Watch out: current code calls undefined requireAuthenticatedMember
  //   (line 121) — that ReferenceError is why this is exercise material.
  //   Rules: GROUP_NOT_FOUND, creator cannot leave (CREATOR_CANNOT_LEAVE),
  //   then repo.pullMember (strips admin too).
  async leaveGroup(memberId, groupId) {
    throw new Error("TODO(leaveGroup): port from src/resolvers/group.js:120");
  },

  // TODO(exercise 4): port addGroupAdmin / removeGroupAdmin /
  //   removeGroupMember (src/resolvers/group.js:141-207) here following the
  //   same shape: fetch via repo -> assert via this.assertGroup* ->
  //   mutate via repo -> throw groupErrors codes.
  //   Cascade note: deleteGroup must also remove the group's posts. Do that
  //   via groupPostRepository.deleteByGroupId (repo import), NOT by
  //   importing a post *service* — see SCAFFOLD-README.md "Can services
  //   call services?".
};
