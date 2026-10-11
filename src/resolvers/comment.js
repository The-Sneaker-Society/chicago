import { getAuthenticatedMemberId } from "../auth/getAuthenticatedMemberId.js";
import { groupCommentService } from "../group-comments/groupComment.service.js";
import { groupPostErrors } from "../group-posts/groupPost.constants.js";

const translateCommentError = (error, action) => {
  switch (error.message) {
    case groupPostErrors.notFound:
      return new Error("Post not found");

    case groupPostErrors.groupNotFound:
      return new Error("Group not found");

    case groupPostErrors.commentNotFound:
      return new Error("Comment not found");

    case groupPostErrors.commentContentRequired:
      return new Error("Comment content is required.");

    case groupPostErrors.forbidden:
      // FORBIDDEN covers both membership and ownership/role failures.
      // Use a message that accurately covers either reason.
      return new Error(
        `You do not have permission to ${action} comments in this group.`,
      );

    default:
      return error;
  }
};

const Mutation = {
  async addComment(parent, { postId, content }, ctx) {
    try {
      const memberId = getAuthenticatedMemberId(ctx);

      return await groupCommentService.addComment(memberId, {
        postId,
        content,
      });
    } catch (error) {
      throw translateCommentError(error, "add");
    }
  },

  async updateComment(parent, { postId, commentId, content }, ctx) {
    try {
      const memberId = getAuthenticatedMemberId(ctx);

      return await groupCommentService.updateComment(memberId, {
        postId,
        commentId,
        content,
      });
    } catch (error) {
      throw translateCommentError(error, "edit");
    }
  },

  async deleteComment(parent, { postId, commentId }, ctx) {
    try {
      const memberId = getAuthenticatedMemberId(ctx);

      return await groupCommentService.deleteComment(memberId, {
        postId,
        commentId,
      });
    } catch (error) {
      throw translateCommentError(error, "delete");
    }
  },
};

export default { Mutation };
