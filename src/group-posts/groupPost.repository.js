import GroupPostModel from "../models/GroupPost.model";

const _populated = (query) =>
  query.populate("author").populate("likes").populate("comments.author");

export const groupPostRepository = {
  async findById(postId) {
    return await GroupPostModel.findById(postId);
  },

  async save(post) {
    return await post.save();
  },

  async findByIdPopulated(postId) {
    return await _populated(GroupPostModel.findById(postId));
  },

  async findPageByGroup(groupId) {
    return await GroupPostModel.find({ groupId })
      .populate("author")
      .populate("likes")
      .sort({ createdAt: -1 });
  },

  async populateCommentAuthors(comments) {
    return await GroupPostModel.populate(comments, { path: "author" });
  },

  async create(data) {
    const created = await GroupPostModel.create(data);
    return await this.findByIdPopulated(created._id);
  },

  async deleteById(postId) {
    return await GroupPostModel.findByIdAndDelete(postId);
  },

  async deleteByGroupId(groupId) {
    return await GroupPostModel.deleteMany({ groupId });
  },

  async addLike(postId, memberId) {
    return await _populated(
      GroupPostModel.findByIdAndUpdate(
        postId,
        { $addToSet: { likes: memberId } },
        { new: true, runValidators: true },
      ),
    );
  },

  async removeLike(postId, memberId) {
    return await _populated(
      GroupPostModel.findByIdAndUpdate(
        postId,
        { $pull: { likes: memberId } },
        { new: true, runValidators: true },
      ),
    );
  },

  async addComment(postId, comment) {
    return await _populated(
      GroupPostModel.findByIdAndUpdate(
        postId,
        { $push: { comments: comment } },
        { new: true, runValidators: true },
      ),
    );
  },

  async updateComment(postId, commentId, content) {
    return await _populated(
      GroupPostModel.findOneAndUpdate(
        {
          _id: postId,
          "comments._id": commentId,
        },
        {
          $set: { "comments.$.content": content },
        },
        { new: true, runValidators: true },
      ),
    );
  },

  async deleteComment(postId, commentId) {
    return await GroupPostModel.findOneAndUpdate(
      {
        _id: postId,
        "comments._id": commentId,
      },
      {
        $pull: { comments: { _id: commentId } },
      },
      { new: true, runValidators: true },
    );
  },
};
