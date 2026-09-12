import { groupPostRepository } from "./groupPost.repository.js";
import { groupPostErrors } from "./groupPost.constants.js";
import { groupRepository } from "../groups/group.repository.js";
import { groupService } from "../groups/group.service.js";
import {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  normalizeLimit,
  normalizeOffset,
  buildPage,
} from "../utils/pagination.js";

/**
 * SCAFFOLD — teaching example, not wired to any resolver yet.
 *
 * `createPost` is the WORKED EXAMPLE: one full vertical slice of the
 * resolver -> service -> repository pattern. Everything else is a TODO
 * stub for you to port following the same shape.
 *
 * Compare with the current src/resolvers/groupPost.js:84 createPost, which
 * mixes auth, validation, and `new GroupPostModel(...)` inline. Here each
 * layer has one job (see SCAFFOLD-README.md "The pattern in 30 seconds").
 */

export const groupPostService = {
  // ---------------------------------------------------------- WORKED EXAMPLE
  async createPost(memberId, { groupId, content, images = [] }) {
    // 1. Validate input (service owns business rules).
    if (!content?.trim()) {
      throw new Error(groupPostErrors.contentRequired);
    }

    // 2. Fetch the group through ITS repository — never import another
    //    domain's model (GroupsModel) directly. Cross-domain data access
    //    goes through the owning domain's repo.
    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new Error(groupPostErrors.groupNotFound);
    }

    // 3. AuthZ via the owning domain's asserts (reuses wrapped logic
    //    instead of copy-pasting isGroupMember checks).
    groupService.assertGroupMember(group, memberId);

    // 4. Persist through OUR repository — no `new GroupPostModel()` here.
    return await groupPostRepository.create({
      groupId,
      author: memberId,
      content: content.trim(),
      images,
      likes: [],
      comments: [],
    });
  },

  // Thin-resolver counterpart (NOT created here — you write it in
  // src/resolvers/groupPost.js when porting):
  //
  //   async createPost(parent, { groupId, content, images }, ctx) {
  //     try {
  //       const memberId = getAuthenticatedMemberId(ctx); // authN in resolver
  //       return await groupPostService.createPost(memberId, { groupId, content, images });
  //     } catch (error) {
  //       // translate: POST_CONTENT_REQUIRED -> "Post content is required."
  //       //           GROUP_NOT_FOUND      -> "Group not found"
  //       //           FORBIDDEN            -> "You must be a member..."
  //       throw translatePostError(error);
  //     }
  //   }
  //
  // Note: this branch predates src/auth/guards.js, so authN stays as
  // getAuthenticatedMemberId(ctx) for now. When this work rebases onto
  // main, that line becomes `requireMember(...)` + String(ctx.dbUser._id).

  // TODO(exercise 1): port getPostsByGroup (src/resolvers/groupPost.js:21).
  //   Signature: async listByGroup(memberId, { groupId, limit, offset })
  //   Steps: groupRepository.findById -> assertGroupMember -> countByGroup +
  //   findPageByGroup -> buildPage. Keep the null-author filter, but apply
  //   it BEFORE buildPage so totalCount stays honest (current line 44
  //   filters after counting — totalCount/hasMore lie).
  async listByGroup(memberId, { groupId, limit, offset }) {
    throw new Error(
      "TODO(listByGroup): port from src/resolvers/groupPost.js:21",
    );
  },

  // TODO(exercise 2): port updatePost (src/resolvers/groupPost.js:104).
  //   Signature: async updatePost(memberId, { postId, content, images })
  //   Steps: findById -> POST_NOT_FOUND; author check (only author edits);
  //   groupRepository.findById(post.groupId) -> assertGroupMember; mutate +
  //   save via repo; return populated.
  async updatePost(memberId, { postId, content, images }) {
    throw new Error(
      "TODO(updatePost): port from src/resolvers/groupPost.js:104",
    );
  },

  // TODO(exercise 2): port deletePost (src/resolvers/groupPost.js:134).
  //   Rule: author OR group creator/admin. Fetch group, then
  //   groupService.assertGroupAdmin OR author-check — mind the difference
  //   between member-authZ (assert) and author-ownership (String compare).
  async deletePost(memberId, postId) {
    throw new Error(
      "TODO(deletePost): port from src/resolvers/groupPost.js:134",
    );
  },

  // TODO(exercise 2): port likePost toggle (src/resolvers/groupPost.js:151).
  async toggleLike(memberId, postId) {
    throw new Error(
      "TODO(toggleLike): port from src/resolvers/groupPost.js:151",
    );
  },
};

// Re-export pagination passthrough so learners see the intended import
// shape; resolvers keep importing limits from utils/pagination directly.
export { DEFAULT_POST_LIMIT, MAX_POST_LIMIT, normalizeLimit, normalizeOffset, buildPage };
