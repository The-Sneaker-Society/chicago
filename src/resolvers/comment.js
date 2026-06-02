import PostModel from "../models/Post.model";
import {
  requireAuthenticatedMember,
  isGroupAdminOrCreator,
} from "../utils/groupPermissions";
import { getPostAndGroup } from "../utils/groupQueries";

const Mutation = {
  async addComment(parent, { postId, content }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    if (!content || !content.trim()) {
      throw new Error("Comment content is required.");
    }

    const { post, group } = await getPostAndGroup(postId);
    const isMember = (group.members || []).some(
      (id) => String(id) === memberId,
    );

    if (!isMember) {
      throw new Error("You must be a member of this group to comment.");
    }

    post.comments.push({ author: memberId, content: content.trim() });
    await post.save();

    const updatedPost = await PostModel.findById(post._id).populate(
      "comments.author",
    );

    return updatedPost.comments[updatedPost.comments.length - 1];
  },

  async updateComment(parent, { postId, commentId, content }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    if (!content || !content.trim()) {
      throw new Error("Comment content is required.");
    }

    const { post, group } = await getPostAndGroup(postId);
    const isMember = (group.members || []).some(
      (id) => String(id) === memberId,
    );

    if (!isMember) {
      throw new Error("You must be a member of this group to edit a comment.");
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      throw new Error("Comment not found");
    }

    if (String(comment.author) !== memberId) {
      throw new Error("Only the comment author can edit this comment.");
    }

    comment.content = content.trim();
    await post.save();

    const updatedPost = await PostModel.findById(post._id).populate(
      "comments.author",
    );

    return updatedPost.comments.id(commentId);
  },

  async deleteComment(parent, { postId, commentId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const { post, group } = await getPostAndGroup(postId);

    const isMember = (group.members || []).some(
      (id) => String(id) === memberId,
    );

    if (!isMember) {
      throw new Error(
        "You must be a member of this group to delete a comment.",
      );
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      throw new Error("Comment not found");
    }

    const isCommentAuthor = String(comment.author) === memberId;
    const canManage = isGroupAdminOrCreator(group, memberId);

    if (!isCommentAuthor && !canManage) {
      throw new Error(
        "Only the comment author or a group admin can delete this comment.",
      );
    }

    comment.deleteOne();
    await post.save();

    return true;
  },
};

export default { Mutation };
