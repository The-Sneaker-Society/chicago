import PostModel from "../models/Post.model";
import {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_LIMIT,
  normalizeLimit,
  normalizeOffset,
  buildPage,
} from "../utils/groupPagination";
import {
  requireAuthenticatedMember,
  requireGroupMembership,
  isGroupAdminOrCreator,
} from "../utils/groupPermissions";
import { getPostAndGroup, getPopulatedPost } from "../utils/groupQueries";

const Query = {
  async getPostsByGroup(
    parent,
    { groupId, limit = DEFAULT_POST_LIMIT, offset = 0 },
  ) {
    const normalizedLimit = normalizeLimit(
      limit,
      DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const normalizedOffset = normalizeOffset(offset);

    const totalCount = await PostModel.countDocuments({ groupId });

    const rawItems = await PostModel.find({ groupId })
      .populate("author")
      .populate("likes")
      .sort({ createdAt: -1 })
      .skip(normalizedOffset)
      .limit(normalizedLimit);

    const items = rawItems.filter((post) => !!post.author);

    return buildPage({
      items,
      totalCount,
      offset: normalizedOffset,
    });
  },
};

const Post = {
  commentCount(parent) {
    return parent.comments?.length || 0;
  },

  async commentsPage(parent, { limit = DEFAULT_COMMENT_LIMIT, offset = 0 }) {
    const normalizedLimit = normalizeLimit(
      limit,
      DEFAULT_COMMENT_LIMIT,
      MAX_COMMENT_LIMIT,
    );
    const normalizedOffset = normalizeOffset(offset);

    const allComments = parent.comments || [];
    const totalCount = allComments.length;

    const slice = allComments.slice(
      normalizedOffset,
      normalizedOffset + normalizedLimit,
    );

    await PostModel.populate(slice, { path: "author" });

    const items = slice.filter((comment) => !!comment.author);

    return buildPage({
      items,
      totalCount,
      offset: normalizedOffset,
    });
  },
};

const Mutation = {
  async createPost(parent, { groupId, content, images = [] }, ctx) {
    const { memberId } = await requireGroupMembership(groupId, ctx);

    if (!content || !content.trim()) {
      throw new Error("Post content is required.");
    }

    const post = new PostModel({
      groupId,
      author: memberId,
      content: content.trim(),
      images,
      likes: [],
      comments: [],
    });

    const saved = await post.save();
    return await getPopulatedPost(saved._id);
  },

  async updatePost(parent, { postId, content, images = [] }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    if (!content || !content.trim()) {
      throw new Error("Post content is required.");
    }

    const { post, group } = await getPostAndGroup(postId);
    const isAuthor = String(post.author) === memberId;

    if (!isAuthor) {
      throw new Error("Only the post author can edit this post.");
    }

    const isMember = (group.members || []).some(
      (id) => String(id) === memberId,
    );

    if (!isMember) {
      throw new Error("You must be a member of this group to edit a post.");
    }

    post.content = content.trim();
    post.images = images;
    await post.save();

    return await getPopulatedPost(post._id);
  },

  async deletePost(parent, { postId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const { post, group } = await getPostAndGroup(postId);

    const isAuthor = String(post.author) === memberId;
    const canManage = isGroupAdminOrCreator(group, memberId);

    if (!isAuthor && !canManage) {
      throw new Error(
        "Only the post author or a group admin can delete this post.",
      );
    }

    const result = await PostModel.findByIdAndDelete(postId);
    return !!result;
  },

  async likePost(parent, { postId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const { post, group } = await getPostAndGroup(postId);

    const isMember = (group.members || []).some(
      (id) => String(id) === memberId,
    );

    if (!isMember) {
      throw new Error("You must be a member of this group to like a post.");
    }

    const alreadyLiked = (post.likes || []).some(
      (id) => String(id) === memberId,
    );

    post.likes = alreadyLiked
      ? post.likes.filter((id) => String(id) !== memberId)
      : [...post.likes, memberId];

    await post.save();
    return await getPopulatedPost(post._id);
  },
};

export default { Query, Mutation, Post };
