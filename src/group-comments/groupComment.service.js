import mongoose from "mongoose";
import { groupPostRepository } from "../group-posts/groupPost.repository.js";
import { groupPostErrors } from "../group-posts/groupPost.constants.js";
import { assertCanDeleteGroupContent } from "../group-posts/groupPost.authorization.js";
import { groupRepository } from "../groups/group.repository.js";
import { groupService } from "../groups/group.service.js";
import {
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_LIMIT,
  normalizeLimit,
  normalizeOffset,
  buildPage,
} from "../utils/pagination.js";

const getPostWithGroup = async (postId) => {
  const post = await groupPostRepository.findById(postId);

  if (!post) {
    throw new Error(groupPostErrors.notFound);
  }

  const group = await groupRepository.findById(post.groupId);

  if (!group) {
    throw new Error(groupPostErrors.groupNotFound);
  }

  return { post, group };
};

const getPostWithGroupAccess = async (postId, memberId) => {
  const { post, group } = await getPostWithGroup(postId);

  groupService.assertGroupMember(group, memberId);

  return { post, group };
};

const throwMissingCommentOrPost = async (postId) => {
  const post = await groupPostRepository.findById(postId);

  if (!post) {
    throw new Error(groupPostErrors.notFound);
  }

  throw new Error(groupPostErrors.commentNotFound);
};

export const groupCommentService = {
  async addComment(memberId, { postId, content }) {
    if (!content?.trim()) {
      throw new Error(groupPostErrors.commentContentRequired);
    }

    const { post } = await getPostWithGroupAccess(postId, memberId);
    const commentId = new mongoose.Types.ObjectId();

    const updatedPost = await groupPostRepository.addComment(post._id, {
      _id: commentId,
      author: memberId,
      content: content.trim(),
    });

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

    const updatedPost = await groupPostRepository.updateComment(
      post._id,
      commentId,
      content.trim(),
    );

    if (!updatedPost) {
      await throwMissingCommentOrPost(post._id);
    }

    const updatedComment = updatedPost.comments.id(commentId);

    if (!updatedComment) {
      throw new Error(groupPostErrors.commentNotFound);
    }

    return updatedComment;
  },

  async deleteComment(memberId, { postId, commentId }) {
    const { post, group } = await getPostWithGroup(postId);
    const comment = post.comments.id(commentId);

    if (!comment) {
      throw new Error(groupPostErrors.commentNotFound);
    }

    assertCanDeleteGroupContent(group, comment.author, memberId);

    const updatedPost = await groupPostRepository.deleteComment(
      post._id,
      commentId,
    );

    if (!updatedPost) {
      await throwMissingCommentOrPost(post._id);
    }

    return true;
  },

  async getValidComments(post) {
    const populatedComments = await groupPostRepository.populateCommentAuthors(
      post.comments || [],
    );

    return populatedComments.filter((comment) => Boolean(comment.author));
  },

  async commentCount(post) {
    const validComments = await groupCommentService.getValidComments(post);

    return validComments.length;
  },

  async commentsPage(post, { limit = DEFAULT_COMMENT_LIMIT, offset = 0 }) {
    const normalizedLimit = normalizeLimit(
      limit,
      DEFAULT_COMMENT_LIMIT,
      MAX_COMMENT_LIMIT,
    );
    const normalizedOffset = normalizeOffset(offset);

    const validComments = await groupCommentService.getValidComments(post);

    const items = validComments.slice(
      normalizedOffset,
      normalizedOffset + normalizedLimit,
    );

    return buildPage({
      items,
      totalCount: validComments.length,
      offset: normalizedOffset,
    });
  },
};
