import GroupPostModel from "../models/GroupPost.model";
import {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_LIMIT,
  normalizeLimit,
  normalizeOffset,
  buildPage,
} from "../utils/pagination";
import {
  getAuthenticatedMemberId,
  isGroupAdmin,
  isGroupCreator,
  isGroupMember,
  requireGroupMembership,
} from "../utils/groupPermissions";
import { getPostAndGroup, getPopulatedPost } from "../utils/groupQueries";

const Query = {
  async getPostsByGroup(
    parent,
    { groupId, limit = DEFAULT_POST_LIMIT, offset = 0 },
    ctx,
  ) {
    await requireGroupMembership(groupId, ctx);

    const normalizedLimit = normalizeLimit(
      limit,
      DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const normalizedOffset = normalizeOffset(offset);

    const totalCount = await GroupPostModel.countDocuments({ groupId });

    const rawItems = await GroupPostModel.find({ groupId })
      .populate("author")
      .populate("likes")
      .sort({ createdAt: -1 })
      .skip(normalizedOffset)
      .limit(normalizedLimit);

    const items = rawItems.filter((post) => Boolean(post.author));

    return buildPage({
      items,
      totalCount,
      offset: normalizedOffset,
    });
  },
};

const GroupPost = {
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

    await GroupPostModel.populate(slice, { path: "author" });

    return buildPage({
      items: slice.filter((comment) => Boolean(comment.author)),
      totalCount,
      offset: normalizedOffset,
    });
  },
};

const Mutation = {
  async createPost(parent, { groupId, content, images = [] }, ctx) {
    const { memberId } = await requireGroupMembership(groupId, ctx);

    if (!content?.trim()) {
      throw new Error("Post content is required.");
    }

    const post = new GroupPostModel({
      groupId,
      author: memberId,
      content: content.trim(),
      images,
      likes: [],
      comments: [],
    });

    const saved = await post.save();
    return getPopulatedPost(saved._id);
  },

  async updatePost(parent, { postId, content, images = [] }, ctx) {
    const memberId = getAuthenticatedMemberId(ctx);
    if (!content?.trim()) {
      throw new Error("Post content is required.");
    }

    const { post, group } = await getPostAndGroup(postId);

    if (String(post.author) !== memberId) {
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

    return getPopulatedPost(post._id);
  },

  async deletePost(parent, { postId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const { post, group } = await getPostAndGroup(postId);
    const isAuthor = String(post.author) === memberId;
    const canManage =
      isGroupCreator(group, memberId) || isGroupAdmin(group, memberId);

    if (!isAuthor && !canManage) {
      throw new Error(
        "Only the post author or a group admin can delete this post.",
      );
    }

    const result = await GroupPostModel.findByIdAndDelete(postId);
    return Boolean(result);
  },

  async likePost(parent, { postId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const { post, group } = await getPostAndGroup(postId);
    const isMember = isGroupMember(group, memberId);

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
    return getPopulatedPost(post._id);
  },
};

export default { Query, Mutation, GroupPost };
