import GroupsModel from "../models/Groups.model";

const requireAuthenticatedMember = (ctx) => {
  if (ctx.role !== "member" || !ctx.dbUser?._id) {
    throw new Error("Only authenticated members can perform this action.");
  }

  return String(ctx.dbUser._id);
};

const requireGroupAdminAccess = async (groupId, ctx) => {
  const memberId = requireAuthenticatedMember(ctx);

  const group = await GroupsModel.findById(groupId);
  if (!group) {
    throw new Error("Group not found");
  }

  const isCreator = String(group.createdBy) === memberId;
  const isAdmin = (group.admins || []).some((id) => String(id) === memberId);

  if (!isCreator && !isAdmin) {
    throw new Error(
      "Only the group creator or an admin can perform this action.",
    );
  }

  return { group, memberId };
};

const Query = {
  async getGroup(parent, { id }, ctx, info) {
    return await GroupsModel.findById(id)
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },

  async getGroups() {
    return await GroupsModel.find({})
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },

  async getGroupsForUser(parent, { userId }) {
    return await GroupsModel.find({ members: userId })
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },
};

const Mutation = {
  async createGroup(parent, args, ctx, info) {
    const { name, description, avatar, memberIds = [] } = args;

    if (!name || !name.trim()) {
      throw new Error("Group name is required.");
    }

    const creatorMemberId = requireAuthenticatedMember(ctx);

    const members = [...new Set([creatorMemberId, ...memberIds.map(String)])];

    const newGroup = new GroupsModel({
      name: name.trim(),
      description,
      avatar,
      members,
      createdBy: creatorMemberId,
      admins: [creatorMemberId],
    });

    const res = await newGroup.save();
    return await GroupsModel.findById(res._id)
      .populate("members")
      .populate("createdBy")
      .populate("admins");
  },

  async updateGroup(parent, { id, name, description, avatar, memberIds }, ctx) {
    const { group: existingGroup } = await requireGroupAdminAccess(id, ctx);

    const update = {};

    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error("Group name cannot be empty.");
      }
      update.name = name.trim();
    }

    if (description !== undefined) update.description = description;
    if (avatar !== undefined) update.avatar = avatar;

    if (memberIds !== undefined) {
      const nextMembers = [...new Set(memberIds.map(String))];
      const creatorId = String(existingGroup.createdBy);

      if (!nextMembers.includes(creatorId)) {
        throw new Error("The group creator must remain a member.");
      }

      update.members = nextMembers;
    }

    const group = await GroupsModel.findByIdAndUpdate(id, update, {
      new: true,
    })
      .populate("members")
      .populate("createdBy")
      .populate("admins");

    if (!group) throw new Error("Group not found");

    return group;
  },

  async deleteGroup(parent, { id }, ctx) {
    await requireGroupAdminAccess(id, ctx);

    const result = await GroupsModel.findByIdAndDelete(id);
    return !!result;
  },
};

export default { Query, Mutation };
