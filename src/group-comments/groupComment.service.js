import { groupPostRepository } from "../group-posts/groupPost.repository.js";
import { groupRepository } from "../groups/group.repository.js";
import { groupService } from "../groups/group.service.js";

/**
 * SCAFFOLD — teaching example, not wired to any resolver yet.
 *
 * Comments live ON the GroupPost document (GroupPostCommentSchema), so this
 * service legitimately imports the POST repository — comments are part of
 * the post aggregate, not a third Mongoose model. If comments ever become
 * their own collection, this file grows its own repository the same way.
 *
 * TODO(exercise 3): port the three functions from
 * src/services/getPostComment.service.js here, changing ONLY the seams:
 *
 *   1. Stop taking raw `ctx`. Take `memberId` (string) instead.
 *      Delete the getAuthenticatedMemberId(ctx) call — the resolver does
 *      that before calling you. (Current file: lines 10-11, 29-34.)
 *   2. Replace getGroupOrThrow(post.groupId) + manual isGroupMember with:
 *        const group = await groupRepository.findById(post.groupId);
 *        groupService.assertGroupMember(group, memberId);
 *   3. Replace isGroupCreator/isGroupAdmin with
 *      groupService.assertGroupAdmin(group, memberId) — EXCEPT deleteComment,
 *      where author-or-moderator needs a try/catch around the assert
 *      (author can delete their own comment without being an admin).
 *   4. Throw frozen codes (add COMMENT_NOT_FOUND to
 *      src/group-posts/groupPost.constants.js) instead of sentences.
 *
 * getPostComment.service.js is the closest thing on this branch to the
 * target shape — it is already a service; it just needs its seams fixed.
 */

export const groupCommentService = {
  async addComment(memberId, { postId, content }) {
    throw new Error(
      "TODO(addComment): port from src/services/getPostComment.service.js:29",
    );
  },

  async updateComment(memberId, { postId, commentId, content }) {
    throw new Error(
      "TODO(updateComment): port from src/services/getPostComment.service.js:50",
    );
  },

  async deleteComment(memberId, { postId, commentId }) {
    throw new Error(
      "TODO(deleteComment): port from src/services/getPostComment.service.js:76",
    );
  },
};

// Silence unused-import warnings until the TODOs are implemented — these
// imports ARE the lesson (repo-to-repo + service asserts, no ctx, no models).
void groupPostRepository;
void groupRepository;
void groupService;
