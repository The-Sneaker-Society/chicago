import GroupsModel from "../models/Groups.model";

const Query = {
  async groups(parent, args, ctx, info) {
    try {
      // Fetch all groups, optionally populate members if your schema uses them
      const groups = await GroupsModel.find().populate("members");
      return groups;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createGroup(parent, args, ctx, info) {
    try {
      const { name, description, avatar, memberIds } = args.data;

      if (!name || !memberIds || memberIds.length === 0) {
        throw new Error("Group name and at least one member are required.");
      }

      // Create new group instance
      const newGroup = new GroupsModel({
        name,
        description,
        avatar,
        members: memberIds,
      });

      // Save to DB
      const res = await newGroup.save();

      // Optionally populate members before returning
      return await GroupsModel.findById(res._id).populate("members");
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Mutation };
