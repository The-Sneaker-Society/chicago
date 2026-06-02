import GroupsModel from "../models/Groups.model";

export const requireAuthenticatedMember = (ctx) => {
  if (ctx.role !== "member" || !ctx.dbUser?._id) {
    throw new Error("Only authenticated members can perform this action.");
  }

  return String(ctx.dbUser._id);
};

export const requireGroupCreatorAccess = async (groupId, ctx) => {
  const memberId = requireAuthenticatedMember(ctx);
  const group = await GroupsModel.findById(groupId);

  if (!group) {
    throw new Error("Group not found");
  }

  if (String(group.createdBy) !== memberId) {
    throw new Error("Only the group creator can perform this action.");
  }

  return { group, memberId };
};

export const requireGroupAdminAccess = async (groupId, ctx) => {
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

export const requireGroupMembership = async (groupId, ctx) => {
  const memberId = requireAuthenticatedMember(ctx);
  const group = await GroupsModel.findById(groupId);

  if (!group) {
    throw new Error("Group not found");
  }

  const isMember = (group.members || []).some((id) => String(id) === memberId);

  if (!isMember) {
    throw new Error(
      "You must be a member of this group to perform this action.",
    );
  }

  return { group, memberId };
};

export const isGroupAdminOrCreator = (group, memberId) => {
  const isCreator = String(group.createdBy) === memberId;
  const isAdmin = (group.admins || []).some((id) => String(id) === memberId);
  return isCreator || isAdmin;
};
