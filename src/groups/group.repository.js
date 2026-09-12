import GroupsModel from "../models/Groups.model";

/**
 * SCAFFOLD — teaching example, not wired to any resolver yet.
 *
 * Sole owner of ALL Group-document DB access. No validation, no auth,
 * no business rules — just Mongoose queries. Compare with the two places
 * that currently do Group reads:
 *   - src/utils/groupPermissions.js:27 getGroupOrThrow (findById)
 *   - src/utils/groupQueries.js:20 getPopulatedGroup (findById + populates)
 * Both of those move here; the utils get deleted when the move is done.
 */

const _populated = (query) =>
  query.populate("members").populate("createdBy").populate("admins");

export const groupRepository = {
  async findById(id) {
    return await GroupsModel.findById(id);
  },

  async findByIdPopulated(id) {
    return await _populated(GroupsModel.findById(id));
  },

  async findByMemberId(userId) {
    return await _populated(GroupsModel.find({ members: userId }));
  },

  async create(data) {
    const created = await GroupsModel.create(data);
    return await this.findByIdPopulated(created._id);
  },

  async updateById(id, updates = {}) {
    return await _populated(
      GroupsModel.findByIdAndUpdate(id, updates, { new: true }),
    );
  },

  async addMember(groupId, memberId) {
    return await _populated(
      GroupsModel.findByIdAndUpdate(
        groupId,
        { $addToSet: { members: memberId } },
        { new: true },
      ),
    );
  },

  async pullMember(groupId, memberId) {
    // Leaving also strips admin — one place owns that invariant.
    return await _populated(
      GroupsModel.findByIdAndUpdate(
        groupId,
        { $pull: { members: memberId, admins: memberId } },
        { new: true },
      ),
    );
  },

  async addAdmin(groupId, memberId) {
    return await _populated(
      GroupsModel.findByIdAndUpdate(
        groupId,
        { $addToSet: { admins: memberId } },
        { new: true },
      ),
    );
  },

  async pullAdmin(groupId, memberId) {
    return await _populated(
      GroupsModel.findByIdAndUpdate(
        groupId,
        { $pull: { admins: memberId } },
        { new: true },
      ),
    );
  },

  async deleteById(id) {
    return await GroupsModel.findByIdAndDelete(id);
  },
};
