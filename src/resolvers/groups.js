import { UserInputError } from "apollo-server-core";
import GroupModel from "../models/Group.model";
import UserModel from "../models/User.model";

const Query = {
  async groups(parent, args, ctx, info) {
    try {
      const groups = await GroupModel.find();
      return groups;
    } catch (e) {
      throw new Error(e);
    }
  },
  async groupById(parent, args, ctx, info) {
    try {
      const group = await GroupModel.findById(args.id);
      if (!group) {
        throw new Error("Group not found");
      }
      return group;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createGroup(parent, args, ctx, info) {
    try {
      const { name, description, avatar, members } = args.data;

      if (!name) {
        throw new UserInputError("Name is required");
      }

      const newGroup = new GroupModel({
        name,
        description,
        avatar,
        members: members || [],
      });

      const res = await newGroup.save();

      return { ...res._doc, id: res._id };
    } catch (error) {
      throw error;
    }
  },
  async updateGroup(parent, args, ctx, info) {
    try {
      const { id, ...rest } = args.data;

      await GroupModel.findByIdAndUpdate(id, { ...rest }, { new: true });

      return true;
    } catch (error) {
      throw error;
    }
  },
  async deleteGroup(parent, args, ctx, info) {
    try {
      await GroupModel.findByIdAndUpdate(args.id, { deletedAt: Date.now() }, { new: true });
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },
  async addMemberToGroup(parent, args, ctx, info) {
    try {
      const { groupId, userId } = args;

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new UserInputError("User not found");
      }

      await GroupModel.findByIdAndUpdate(
        groupId,
        { $addToSet: { members: userId } },
        { new: true }
      );

      return true;
    } catch (error) {
      throw error;
    }
  },
  async removeMemberFromGroup(parent, args, ctx, info) {
    try {
      const { groupId, userId } = args;

      await GroupModel.findByIdAndUpdate(
        groupId,
        { $pull: { members: userId } },
        { new: true }
      );

      return true;
    } catch (error) {
      throw error;
    }
  },
};

const Group = {
  async members(parent, args, ctx, info) {
    try {
      const memberIds = parent.members || [];
      if (!memberIds.length) return [];

      const users = await UserModel.find({ _id: { $in: memberIds } });

      return users;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Mutation, Group };
