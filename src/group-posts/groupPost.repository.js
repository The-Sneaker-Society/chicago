import GroupPostModel from "../models/GroupPost.model";

/**
 * SCAFFOLD — teaching example, not wired to any resolver yet.
 *
 * Sole owner of ALL GroupPost-document DB access. Absorbs:
 *   - src/utils/groupQueries.js:4 getPostAndGroup (post+group fetch)
 *   - src/utils/groupQueries.js:27 getPopulatedPost
 *   - the inline count/find/populate/sort/skip/limit in
 *     src/resolvers/groupPost.js:35-42 (getPostsByGroup)
 */

const _populated = (query) =>
  query.populate("author").populate("likes").populate("comments.author");

export const groupPostRepository = {
  async findById(postId) {
    return await GroupPostModel.findById(postId);
  },

  async findByIdPopulated(postId) {
    return await _populated(GroupPostModel.findById(postId));
  },

  async countByGroup(groupId) {
    return await GroupPostModel.countDocuments({ groupId });
  },

  async findPageByGroup(groupId, { offset, limit }) {
    return await GroupPostModel.find({ groupId })
      .populate("author")
      .populate("likes")
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
  },

  async create(data) {
    const created = await GroupPostModel.create(data);
    return await this.findByIdPopulated(created._id);
  },

  async deleteById(postId) {
    return await GroupPostModel.findByIdAndDelete(postId);
  },

  // Used by groupService.deleteGroup for the cascade. The GROUP domain
  // imports this repo (repo-to-repo is fine); it never imports a post
  // *service*. See SCAFFOLD-README.md "Can services call services?".
  async deleteByGroupId(groupId) {
    return await GroupPostModel.deleteMany({ groupId });
  },
};
