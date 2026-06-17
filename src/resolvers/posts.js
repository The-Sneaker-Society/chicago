import MemberModel from "../models/Member.model";
import PostModel from "../models/Post.model";

const PUBLIC_MEMBER_SELECT =
  "firstName lastName businessName state isActive subscriptionStatus";

const Query = {
  async getMySocietyFeed(parent, args, ctx) {
    try {
      const limit = args.limit ?? 10;
      const offset = args.offset ?? 0;

      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      // Feed = posts from members the current user follows + their own posts
      const feedMemberIds = [
        currentMember._id,
        ...(currentMember.following || []),
      ];

      const filter = {
        memberId: { $in: feedMemberIds },
        deletedAt: null,
      };

      const [total, items] = await Promise.all([
        PostModel.countDocuments(filter),
        PostModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .lean(),
      ]);

      const hasMore = offset + items.length < total;
      const nextOffset = hasMore ? offset + limit : null;

      return { items, hasMore, nextOffset };
    } catch (e) {
      throw new Error(e);
    }
  },

  async getPostComments(parent, args, ctx) {
    try {
      const limit = args.limit ?? 10;
      const offset = args.offset ?? 0;

      const post = await PostModel.findById(args.postId).lean();
      if (!post || post.deletedAt) throw new Error("Post not found");

      const allComments = post.comments || [];
      const slice = allComments.slice(offset, offset + limit);
      const hasMore = offset + slice.length < allComments.length;
      const nextOffset = hasMore ? offset + limit : null;

      return { items: slice, hasMore, nextOffset };
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createPost(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const { content = "", mediaUrls = [], mediaType = "none" } = args.data;

      if (!content.trim() && mediaUrls.length === 0) {
        throw new Error("Post must have content or media");
      }

      const post = await PostModel.create({
        memberId: currentMember._id,
        content,
        mediaUrls,
        mediaType,
      });

      return post.toObject();
    } catch (e) {
      throw new Error(e);
    }
  },

  async deletePost(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const post = await PostModel.findById(args.postId);
      if (!post || post.deletedAt) throw new Error("Post not found");

      if (String(post.memberId) !== String(currentMember._id)) {
        throw new Error("Not authorized to delete this post");
      }

      await PostModel.findByIdAndUpdate(args.postId, { deletedAt: new Date() });
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },

  async likePost(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      await PostModel.findByIdAndUpdate(args.postId, {
        $addToSet: { likes: currentMember._id },
      });
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },

  async unlikePost(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      await PostModel.findByIdAndUpdate(args.postId, {
        $pull: { likes: currentMember._id },
      });
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },

  async sharePost(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const original = await PostModel.findById(args.postId);
      if (!original || original.deletedAt) throw new Error("Post not found");

      // Increment share count on the original and create reshare in parallel
      await Promise.all([
        PostModel.findByIdAndUpdate(args.postId, { $inc: { shareCount: 1 } }),
        PostModel.create({
          memberId: currentMember._id,
          content: original.content,
          mediaUrls: original.mediaUrls,
          mediaType: original.mediaType,
          sharedFromId: original._id,
        }),
      ]);

      return true;
    } catch (e) {
      throw new Error(e);
    }
  },

  async addComment(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      if (!args.content?.trim()) throw new Error("Comment cannot be empty");

      const post = await PostModel.findByIdAndUpdate(
        args.postId,
        { $push: { comments: { memberId: currentMember._id, content: args.content.trim() } } },
        { new: true }
      );

      if (!post) throw new Error("Post not found");

      return post.comments[post.comments.length - 1].toObject();
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Post = {
  async member(parent) {
    try {
      return MemberModel.findById(parent.memberId).select(PUBLIC_MEMBER_SELECT);
    } catch (e) {
      throw new Error(e);
    }
  },
  likeCount: (parent) => (parent.likes || []).length,
  isLikedByMe: (parent, args, ctx) => {
    if (!ctx.dbUser) return false;
    return (parent.likes || []).some(
      (id) => String(id) === String(ctx.dbUser._id)
    );
  },
  commentCount: (parent) => (parent.comments || []).length,
  shareCount: (parent) => parent.shareCount || 0,
  createdAt: (parent) =>
    parent.createdAt instanceof Date
      ? parent.createdAt.toISOString()
      : String(parent.createdAt),
};

const PostComment = {
  async member(parent) {
    try {
      return MemberModel.findById(parent.memberId).select(PUBLIC_MEMBER_SELECT);
    } catch (e) {
      throw new Error(e);
    }
  },
  createdAt: (parent) =>
    parent.createdAt instanceof Date
      ? parent.createdAt.toISOString()
      : String(parent.createdAt),
};

export default { Query, Mutation, Post, PostComment };
