import GroupsModel from "../models/Groups.model";

const _populated = (query) =>
  query.populate("members").populate("createdBy").populate("admins");

export const groupRepository = {
  async findByIdPopulated(id) {
    return await _populated(GroupsModel.findById(id));
  },

  async findPopulated() {
    return await _populated(GroupsModel.find({}));
  },

  async findByMemberId(userId) {
    return await _populated(GroupsModel.find({ members: userId }));
  },

  async findById(id) {
    return await GroupsModel.findById(id);
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

  async deleteById(id) {
    return await GroupsModel.findByIdAndDelete(id);
  },
};
