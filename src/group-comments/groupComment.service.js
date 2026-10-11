import { groupPostRepository } from "../group-posts/groupPost.repository.js";
import { groupPostErrors } from "../group-posts/groupPost.constants.js";
import { groupRepository } from "../groups/group.repository.js";
import { groupService } from "../groups/group.service.js";
import {
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_LIMIT,
  normalizeLimit,
  normalizeOffset,
  buildPage,
} from "../utils/pagination.js";

/**
 * Comments are embedded in the GroupPost document, so persistence goes
 * through groupPostRepository.
 *
 * Cross-domain service direction: groupCommentService -> groupService,
 * used only for group authorization assertions.
 *
 * Authentication remains in the resolver. This service takes memberId,
 * never raw ctx, and throws domain error codes.
 */

const getPostWithGroupAccess = async (postId, memberId) => {
  const post = await groupPostRepository.findById(postId);

  if (!post) {
    throw new Error(groupPostErrors.notFound);
  }

  const group = await groupRepository.findById(post.groupId);

  if (!group) {
    throw new Error(groupPostErrors.groupNotFound);
  }

  groupService.assertGroupMember(group, memberId);

  return { post, group };
};

export const groupCommentService = {
  async addComment(memberId, { postId, content }) {
    if (!content?.trim()) {
      throw new Error(groupPostErrors.commentContentRequired);
    }

    const { post } = await getPostWithGroupAccess(postId, memberId);

    post.comments.push({
      author: memberId,
      content: content.trim(),
    });

    const addedComment = post.comments[post.comments.length - 1];
    const commentId = addedComment._id;

    await groupPostRepository.save(post);

    const updatedPost = await groupPostRepository.findByIdPopulated(post._id);

    if (!updatedPost) {
      throw new Error(groupPostErrors.notFound);
    }

    const comment = updatedPost.comments.id(commentId);

    if (!comment) {
      throw new Error(groupPostErrors.commentNotFound);
    }

    return comment;
  },

  async updateComment(memberId, { postId, commentId, content }) {
    if (!content?.trim()) {
      throw new Error(groupPostErrors.commentContentRequired);
    }

    const { post } = await getPostWithGroupAccess(postId, memberId);
    const comment = post.comments.id(commentId);

    if (!comment) {
      throw new Error(groupPostErrors.commentNotFound);
    }

    if (String(comment.author) !== String(memberId)) {
      throw new Error(groupPostErrors.forbidden);
    }

    comment.content = content.trim();

    await groupPostRepository.save(post);

    const updatedPost = await groupPostRepository.findByIdPopulated(post._id);

    if (!updatedPost) {
      throw new Error(groupPostErrors.notFound);
    }

    const updatedComment = updatedPost.comments.id(commentId);

    if (!updatedComment) {
      throw new Error(groupPostErrors.commentNotFound);
    }

    return updatedComment;
  },

  async deleteComment(memberId, { postId, commentId }) {
    const { post, group } = await getPostWithGroupAccess(postId, memberId);
    const comment = post.comments.id(commentId);

    if (!comment) {
      throw new Error(groupPostErrors.commentNotFound);
    }

    const isAuthor = String(comment.author) === String(memberId);

    // Authors may delete their own comments without an admin role.
    // For other callers, preserve unexpected errors from the assertion.
    try {
      groupService.assertGroupAdmin(group, memberId);
    } catch (error) {
      if (error.message !== groupPostErrors.forbidden || !isAuthor) {
        throw error;
      }
    }

    comment.deleteOne();

    await groupPostRepository.save(post);

    return true;
  },
  async commentsPage(post, { limit = DEFAULT_COMMENT_LIMIT, offset = 0 }) {
    const normalizedLimit = normalizeLimit(
      limit,
      DEFAULT_COMMENT_LIMIT,
      MAX_COMMENT_LIMIT,
    );
    const normalizedOffset = normalizeOffset(offset);

    const allComments = post.comments || [];
    const totalCount = allComments.length;

    const slice = allComments.slice(
      normalizedOffset,
      normalizedOffset + normalizedLimit,
    );

    await groupPostRepository.populateCommentAuthors(slice);

    return buildPage({
      items: slice.filter((comment) => Boolean(comment.author)),
      totalCount,
      offset: normalizedOffset,
    });
  },
};
