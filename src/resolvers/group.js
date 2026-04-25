import GroupsModel from "../models/Groups.model";
import PostModel from "../models/Post.model";

const DEFAULT_POST_LIMIT = 10;
const MAX_POST_LIMIT = 50;
const DEFAULT_COMMENT_LIMIT = 10;
const MAX_COMMENT_LIMIT = 50;

const requireAuthenticatedMember = (ctx) => {
  if (ctx.role !== "member" || !ctx.dbUser?._id) {
    throw new Error("Only authenticated members can perform this action.");
  }

  return String(ctx.dbUser._id);
};

const sanitizeLimit = (value, fallback, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const sanitizeOffset = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
};

const buildPage = ({ items, totalCount, offset }) => {
  const nextOffset = offset + items.length;
  return {
    items,
    totalCount,
    hasMore: nextOffset < totalCount,
    nextOffset: nextOffset < totalCount ? nextOffset : null,
  };
};

const requireGroupCreatorAccess = async (groupId, ctx) => {
  const memberId = requireAuthenticatedMember(ctx);
  const group = await GroupsModel.findById(groupId);

  if (!group) {
    throw new Error("Group not found");
  }

  if (String(group.createdBy) !== memberId) {
    throw new Error("Only the group creator can perform this action.");
  }

  return { group, memberId };
};

const requireGroupAdminAccess = async (groupId, ctx) => {
  const memberId = requireAuthenticatedMember(ctx);
  const group = await GroupsModel.findById(groupId);

  if (!group) {
    throw new Error("Group not found");
  }

  const isCreator = String(group.createdBy) === memberId;
  const isAdmin = (group.admins || []).some((id) => String(id) === memberId);

  if (!isCreator && !isAdmin) {
    throw new Error("Only the group creator or an admin can perform this action.");
  }

  return { group, memberId };
};

const requireGroupMembership = async (groupId, ctx) => {
  const memberId = requireAuthenticatedMember(ctx);
  const group = await GroupsModel.findById(groupId);

  if (!group) {
    throw new Error("Group not found");
  }

  const isMember = (group.members || []).some((id) => String(id) === memberId);
  if (!isMember) {
    throw new Error("You must be a member of this group to perform this action.");
  }

  return { group, memberId };
};

const getPostAndGroup = async (postId) => {
  const post = await PostModel.findById(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  const group = await GroupsModel.findById(post.groupId);
  if (!group) {
    throw new Error("Group not found");
  }

  return { post, group };
};

const isGroupAdminOrCreator = (group, memberId) => {
  const isCreator = String(group.createdBy) === memberId;
  const isAdmin = (group.admins || []).some((id) => String(id) === memberId);
  return isCreator || isAdmin;
};

const getPopulatedGroup = async (groupId) => {
  return await GroupsModel.findById(groupId)
    .populate("members")
    .populate("createdBy")
    .populate("admins");
};

const getPopulatedPost = async (postId) => {
  return await PostModel.findById(postId)
    .populate("author")
    .populate("likes")
    .populate("comments.author");
};

const Query = {
  async getGroup(parent, { id }) {
    return await getPopulatedGroup(id);
  },

  async getGroups() {
    return await GroupsModel.find({})
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },

  async getGroupsForUser(parent, { userId }) {
    return await GroupsModel.find({ members: userId })
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },

  async getPostsByGroup(parent, { groupId, limit = DEFAULT_POST_LIMIT, offset = 0 }) {
    const safeLimit = sanitizeLimit(limit, DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const safeOffset = sanitizeOffset(offset);

    const [items, totalCount] = await Promise.all([
      PostModel.find({ groupId })
        .populate("author")
        .populate("likes")
        .populate("comments.author")
        .sort({ createdAt: -1 })
        .skip(safeOffset)
        .limit(safeLimit),
      PostModel.countDocuments({ groupId }),
    ]);

    return buildPage({ items, totalCount, offset: safeOffset });
  },
};

const Post = {
  commentCount(parent) {
    return parent.comments?.length || 0;
  },

  commentsPage(parent, { limit = DEFAULT_COMMENT_LIMIT, offset = 0 }) {
    const safeLimit = sanitizeLimit(limit, DEFAULT_COMMENT_LIMIT, MAX_COMMENT_LIMIT);
    const safeOffset = sanitizeOffset(offset);
    const totalCount = parent.comments?.length || 0;
    const items = (parent.comments || []).slice(safeOffset, safeOffset + safeLimit);

    return buildPage({ items, totalCount, offset: safeOffset });
  },
};

const Mutation = {
  async createGroup(parent, args, ctx) {
    const { name, description, avatar, memberIds = [] } = args;

    if (!name || !name.trim()) {
      throw new Error("Group name is required.");
    }

    const creatorMemberId = requireAuthenticatedMember(ctx);
    const members = [...new Set([creatorMemberId, ...memberIds.map(String)])];

    const newGroup = new GroupsModel({
      name: name.trim(),
      description,
      avatar,
      members,
      createdBy: creatorMemberId,
      admins: [creatorMemberId],
    });

    const saved = await newGroup.save();
    return await getPopulatedGroup(saved._id);
  },

  async updateGroup(parent, { id, name, description, avatar, memberIds }, ctx) {
    const { group: existingGroup } = await requireGroupAdminAccess(id, ctx);
    const update = {};

    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error("Group name cannot be empty.");
      }
      update.name = name.trim();
    }

    if (description !== undefined) update.description = description;
    if (avatar !== undefined) update.avatar = avatar;

    if (memberIds !== undefined) {
      const nextMembers = [...new Set(memberIds.map(String))];
      const creatorId = String(existingGroup.createdBy);

      if (!nextMembers.includes(creatorId)) {
        throw new Error("The group creator must remain a member.");
      }

      update.members = nextMembers;
    }

    const group = await GroupsModel.findByIdAndUpdate(id, update, { new: true });
    if (!group) throw new Error("Group not found");

    return await getPopulatedGroup(group._id);
  },

  async deleteGroup(parent, { id }, ctx) {
    await requireGroupAdminAccess(id, ctx);
    const result = await GroupsModel.findByIdAndDelete(id);
    return !!result;
  },

  async joinGroup(parent, { groupId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    const group = await GroupsModel.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: memberId } },
      { new: true },
    );

    if (!group) throw new Error("Group not found");
    return await getPopulatedGroup(group._id);
  },

  async leaveGroup(parent, { groupId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const group = await GroupsModel.findById(groupId);

    if (!group) throw new Error("Group not found");
    if (String(group.createdBy) === memberId) {
      throw new Error("The group creator cannot leave the group.");
    }

    const updated = await GroupsModel.findByIdAndUpdate(
      groupId,
      { $pull: { members: memberId, admins: memberId } },
      { new: true },
    );

    return await getPopulatedGroup(updated._id);
  },

  async addGroupAdmin(parent, { groupId, memberId }, ctx) {
    const { group } = await requireGroupCreatorAccess(groupId, ctx);
    const normalizedMemberId = String(memberId);

    const isMember = (group.members || []).some((id) => String(id) === normalizedMemberId);
    if (!isMember) {
      throw new Error("Only a current group member can be promoted to admin.");
    }

    await GroupsModel.findByIdAndUpdate(
      groupId,
      { $addToSet: { admins: normalizedMemberId } },
      { new: true },
    );

    return await getPopulatedGroup(groupId);
  },

  async removeGroupAdmin(parent, { groupId, memberId }, ctx) {
    const { group, memberId: actingMemberId } = await requireGroupCreatorAccess(groupId, ctx);
    const normalizedMemberId = String(memberId);

    if (normalizedMemberId === actingMemberId) {
      throw new Error("The group creator cannot remove themselves as an admin.");
    }

    const isCreatorTarget = String(group.createdBy) === normalizedMemberId;
    if (isCreatorTarget) {
      throw new Error("The group creator must remain an admin.");
    }

    await GroupsModel.findByIdAndUpdate(
      groupId,
      { $pull: { admins: normalizedMemberId } },
      { new: true },
    );

    return await getPopulatedGroup(groupId);
  },

  async removeGroupMember(parent, { groupId, memberId }, ctx) {
    const { group } = await requireGroupAdminAccess(groupId, ctx);
    const normalizedMemberId = String(memberId);

    if (String(group.createdBy) === normalizedMemberId) {
      throw new Error("The group creator cannot be removed from the group.");
    }

    const isMember = (group.members || []).some((id) => String(id) === normalizedMemberId);
    if (!isMember) {
      throw new Error("That member is not currently in the group.");
    }

    await GroupsModel.findByIdAndUpdate(
      groupId,
      { $pull: { members: normalizedMemberId, admins: normalizedMemberId } },
      { new: true },
    );

    return await getPopulatedGroup(groupId);
  },

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
      shares: 0,
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

    const isMember = (group.members || []).some((id) => String(id) === memberId);
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
      throw new Error("Only the post author or a group admin can delete this post.");
    }

    const result = await PostModel.findByIdAndDelete(postId);
    return !!result;
  },

  async likePost(parent, { postId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const { post, group } = await getPostAndGroup(postId);

    const isMember = (group.members || []).some((id) => String(id) === memberId);
    if (!isMember) {
      throw new Error("You must be a member of this group to like a post.");
    }

    const alreadyLiked = (post.likes || []).some((id) => String(id) === memberId);
    post.likes = alreadyLiked
      ? post.likes.filter((id) => String(id) !== memberId)
      : [...post.likes, memberId];

    await post.save();
    return await getPopulatedPost(post._id);
  },

  async addComment(parent, { postId, content }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    if (!content || !content.trim()) {
      throw new Error("Comment content is required.");
    }

    const { post, group } = await getPostAndGroup(postId);
    const isMember = (group.members || []).some((id) => String(id) === memberId);

    if (!isMember) {
      throw new Error("You must be a member of this group to comment.");
    }

    post.comments.push({ author: memberId, content: content.trim() });
    await post.save();

    const updatedPost = await PostModel.findById(post._id).populate("comments.author");
    return updatedPost.comments[updatedPost.comments.length - 1];
  },

  async updateComment(parent, { postId, commentId, content }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    if (!content || !content.trim()) {
      throw new Error("Comment content is required.");
    }

    const { post, group } = await getPostAndGroup(postId);
    const isMember = (group.members || []).some((id) => String(id) === memberId);

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

    const updatedPost = await PostModel.findById(post._id).populate("comments.author");
    return updatedPost.comments.id(commentId);
  },

  async deleteComment(parent, { postId, commentId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);
    const { post, group } = await getPostAndGroup(postId);

    const isMember = (group.members || []).some((id) => String(id) === memberId);
    if (!isMember) {
      throw new Error("You must be a member of this group to delete a comment.");
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    const isCommentAuthor = String(comment.author) === memberId;
    const canManage = isGroupAdminOrCreator(group, memberId);

    if (!isCommentAuthor && !canManage) {
      throw new Error("Only the comment author or a group admin can delete this comment.");
    }

    comment.deleteOne();
    await post.save();

    return true;
  },
};

export default { Query, Post, Mutation };