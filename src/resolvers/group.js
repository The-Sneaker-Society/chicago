import GroupsModel from "../models/Groups.model";
import PostModel from "../models/Post.model";

const requireAuthenticatedMember = (ctx) => {
  if (ctx.role !== "member" || !ctx.dbUser?._id) {
    throw new Error("Only authenticated members can perform this action.");
  }

  return String(ctx.dbUser._id);
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
    throw new Error(
      "Only the group creator or an admin can perform this action.",
    );
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

const Query = {
  async getGroup(parent, { id }) {
    return await GroupsModel.findById(id)
      .populate("members")
      .populate("createdBy")
      .populate("admins");
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

  async getPostsByGroup(parent, { groupId }) {
    return await PostModel.find({ groupId })
      .populate("author")
      .populate("likes")
      .populate("comments.author")
      .sort({ createdAt: -1 });
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

    const res = await newGroup.save();

    return await GroupsModel.findById(res._id)
      .populate("members")
      .populate("createdBy")
      .populate("admins");
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

    const group = await GroupsModel.findByIdAndUpdate(id, update, {
      new: true,
    })
      .populate("members")
      .populate("createdBy")
      .populate("admins");

    if (!group) throw new Error("Group not found");

    return group;
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
    )
      .populate("members")
      .populate("createdBy")
      .populate("admins");

    if (!group) throw new Error("Group not found");
    return group;
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
      { $pull: { members: memberId } },
      { new: true },
    )
      .populate("members")
      .populate("createdBy")
      .populate("admins");

    return updated;
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

    return await PostModel.findById(saved._id)
      .populate("author")
      .populate("likes")
      .populate("comments.author");
  },

  async deletePost(parent, { postId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    const post = await PostModel.findById(postId);
    if (!post) throw new Error("Post not found");

    const group = await GroupsModel.findById(post.groupId);
    if (!group) throw new Error("Group not found");

    const isAuthor = String(post.author) === memberId;
    const isCreator = String(group.createdBy) === memberId;
    const isAdmin = (group.admins || []).some((id) => String(id) === memberId);

    if (!isAuthor && !isCreator && !isAdmin) {
      throw new Error("Only the post author or a group admin can delete this post.");
    }

    const result = await PostModel.findByIdAndDelete(postId);
    return !!result;
  },

  async likePost(parent, { postId }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    const post = await PostModel.findById(postId);
    if (!post) throw new Error("Post not found");

    const group = await GroupsModel.findById(post.groupId);
    if (!group) throw new Error("Group not found");

    const isMember = (group.members || []).some((id) => String(id) === memberId);
    if (!isMember) {
      throw new Error("You must be a member of this group to like a post.");
    }

    const alreadyLiked = (post.likes || []).some((id) => String(id) === memberId);

    post.likes = alreadyLiked
      ? post.likes.filter((id) => String(id) !== memberId)
      : [...post.likes, memberId];

    await post.save();

    return await PostModel.findById(post._id)
      .populate("author")
      .populate("likes")
      .populate("comments.author");
  },

  async addComment(parent, { postId, content }, ctx) {
    const memberId = requireAuthenticatedMember(ctx);

    if (!content || !content.trim()) {
      throw new Error("Comment content is required.");
    }

    const post = await PostModel.findById(postId);
    if (!post) throw new Error("Post not found");

    const group = await GroupsModel.findById(post.groupId);
    if (!group) throw new Error("Group not found");

    const isMember = (group.members || []).some((id) => String(id) === memberId);
    if (!isMember) {
      throw new Error("You must be a member of this group to comment.");
    }

    post.comments.push({
      author: memberId,
      content: content.trim(),
    });

    await post.save();

    const updatedPost = await PostModel.findById(post._id).populate("comments.author");
    return updatedPost.comments[updatedPost.comments.length - 1];
  },
};

export default { Query, Mutation };