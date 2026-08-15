import {
  addComment,
  updateComment,
  deleteComment,
} from "../services/groupPostComment.service";

const Mutation = {
  async addComment(parent, { postId, content }, ctx) {
    return addComment({ postId, content, ctx });
  },

  async updateComment(parent, { postId, commentId, content }, ctx) {
    return updateComment({ postId, commentId, content, ctx });
  },

  async deleteComment(parent, { postId, commentId }, ctx) {
    return deleteComment({ postId, commentId, ctx });
  },
};

export default { Mutation };
