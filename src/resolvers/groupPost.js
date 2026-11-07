import { requireMember } from "../auth/guards.js";
import { groupPostService } from "../group-posts/groupPost.service.js";
import { groupPostErrors } from "../group-posts/groupPost.constants.js";
import { groupCommentService } from "../group-comments/groupComment.service.js";
import {
  DEFAULT_POST_LIMIT,
  DEFAULT_COMMENT_LIMIT,
} from "../utils/pagination.js";

const translatePostError = (error, operation) => {
  switch (error.message) {
    case groupPostErrors.notFound:
      return new Error("Post not found");

    case groupPostErrors.groupNotFound:
      return new Error("Group not found");

    case groupPostErrors.contentRequired:
      return new Error("Post content is required.");

    case groupPostErrors.forbidden:
      switch (operation) {
        case "listByGroup":
          return new Error(
            "You must be a member of this group to perform this action.",
          );

        case "createPost":
          return new Error(
            "You must be a member of this group to perform this action.",
          );

        case "updatePost":
          // FORBIDDEN may mean either non-ownership or non-membership.
          return new Error(
            "Only the post author who is a current group member can edit this post.",
          );

        case "deletePost":
          return new Error(
            "Only the post author or a group admin can delete this post.",
          );

        case "toggleLike":
          return new Error(
            "You must be a member of this group to like a post.",
          );

        default:
          return new Error(
            "You do not have permission to perform this action.",
          );
      }

    default:
      return error;
  }
};

// Authentication and error translation remain in the resolver layer.
const runPostOperation = async (ctx, operation, execute) => {
  try {
    const memberId = String(ctx.dbUser._id);
    return await execute(memberId);
  } catch (error) {
    throw translatePostError(error, operation);
  }
};

const Query = {
  getPostsByGroup: requireMember(async (
    parent,
    { groupId, limit = DEFAULT_POST_LIMIT, offset = 0 },
    ctx,
  ) => {
    return await runPostOperation(ctx, "listByGroup", (memberId) =>
      groupPostService.listByGroup(memberId, {
        groupId,
        limit,
        offset,
      }),
    );
  }),
};

const GroupPost = {
  commentCount(parent) {
    return parent.comments?.length || 0;
  },

  async commentsPage(parent, { limit = DEFAULT_COMMENT_LIMIT, offset = 0 }) {
    return await groupCommentService.commentsPage(parent, {
      limit,
      offset,
    });
  },
};

const Mutation = {
  createPost: requireMember(async (parent, { groupId, content, images = [] }, ctx) => {
    return await runPostOperation(ctx, "createPost", (memberId) =>
      groupPostService.createPost(memberId, {
        groupId,
        content,
        images,
      }),
    );
  }),

  updatePost: requireMember(async (parent, { postId, content, images }, ctx) => {
    return await runPostOperation(ctx, "updatePost", (memberId) =>
      groupPostService.updatePost(memberId, {
        postId,
        content,
        images,
      }),
    );
  }),

  deletePost: requireMember(async (parent, { postId }, ctx) => {
    return await runPostOperation(ctx, "deletePost", (memberId) =>
      groupPostService.deletePost(memberId, postId),
    );
  }),

  likePost: requireMember(async (parent, { postId }, ctx) => {
    return await runPostOperation(ctx, "toggleLike", (memberId) =>
      groupPostService.toggleLike(memberId, postId),
    );
  }),
};

export default { Query, Mutation, GroupPost };
