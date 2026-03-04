// src/resolvers/group.js

import GroupsModel from "../models/Groups.model";

const Query = {
  async getGroup(parent, { id }, ctx, info) {
    return await GroupsModel.findById(id).populate("members");
  },

  async getGroups() {
    return await GroupsModel.find({}).populate("members");
  },

  async getGroupsForUser(parent, { userId }) {
    // Groups where userId is in members array
    return await GroupsModel.find({ members: userId }).populate("members");
  },
};

const Mutation = {
  async createGroup(parent, args, ctx, info) {
    const { name, description, avatar, memberIds } = args;
    if (!name) {
      throw new Error("Group name is required.");
    }

    const newGroup = new GroupsModel({
      name,
      description,
      avatar,
      members: memberIds || [], // allow empty
    });

    const res = await newGroup.save();
    return await GroupsModel.findById(res._id).populate("members");
  },

  async updateGroup(parent, { id, name, description, avatar, memberIds }) {
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (avatar !== undefined) update.avatar = avatar;
    if (memberIds !== undefined) update.members = memberIds;
    const group = await GroupsModel.findByIdAndUpdate(id, update, {
      new: true,
    }).populate("members");
    if (!group) throw new Error("Group not found");
    return group;
  },

  async deleteGroup(parent, { id }) {
    const result = await GroupsModel.findByIdAndDelete(id);
    return !!result; // returns true if deleted
  },
};

export default { Query, Mutation };
