import GroupPostModel from "../models/GroupPost.model";
import {
  getAuthenticatedMemberId,
  getGroupOrThrow,
  isGroupAdmin,
  isGroupCreator,
  isGroupMember,
} from "../utils/groupPermissions";

const getPostWithGroupAccess = async (postId, ctx) => {
  const memberId = getAuthenticatedMemberId(ctx);
  const post = await GroupPostModel.findById(postId);

  if (!post) {
    throw new Error("Post not found");
  }

  const group = await getGroupOrThrow(post.groupId);

  if (!isGroupMember(group, memberId)) {
    throw new Error(
      "You must be a member of this group to perform this action.",
    );
  }

  return { post, group, memberId };
};

export const addComment = async ({ postId, content, ctx }) => {
  if (!content?.trim()) {
    throw new Error("Comment content is required.");
  }

  const { post, memberId } = await getPostWithGroupAccess(postId, ctx);

  post.comments.push({
    author: memberId,
    content: content.trim(),
  });

  await post.save();

  const updatedPost = await GroupPostModel.findById(post._id).populate(
    "comments.author",
  );

  return updatedPost.comments[updatedPost.comments.length - 1];
};

export const updateComment = async ({ postId, commentId, content, ctx }) => {
  if (!content?.trim()) {
    throw new Error("Comment content is required.");
  }

  const { post, memberId } = await getPostWithGroupAccess(postId, ctx);
  const comment = post.comments.id(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (String(comment.author) !== memberId) {
    throw new Error("Only the comment author can edit this comment.");
  }

  comment.content = content.trim();
  await post.save();

  const updatedPost = await GroupPostModel.findById(post._id).populate(
    "comments.author",
  );

  return updatedPost.comments.id(commentId);
};

export const deleteComment = async ({ postId, commentId, ctx }) => {
  const { post, group, memberId } = await getPostWithGroupAccess(postId, ctx);
  const comment = post.comments.id(commentId);

  if (!comment) {
    throw new Error("Comment not found");
  }

  const canModerate =
    isGroupCreator(group, memberId) || isGroupAdmin(group, memberId);

  if (String(comment.author) !== memberId && !canModerate) {
    throw new Error(
      "Only the comment author, group creator, or group admin can delete this comment.",
    );
  }

  comment.deleteOne();
  await post.save();

  return true;
};
