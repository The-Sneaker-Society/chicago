import GroupsModel from "../models/Groups.model";

export const getAuthenticatedMemberId = (ctx) => {
  if (ctx.role !== "member" || !ctx.dbUser?._id) {
    throw new Error("Only authenticated members can perform this action.");
  }

  return String(ctx.dbUser._id);
};

export const isGroupCreator = (group, memberId) => {
  return String(group.createdBy) === String(memberId);
};

export const isGroupAdmin = (group, memberId) => {
  return (group.admins || []).some(
    (adminId) => String(adminId) === String(memberId),
  );
};

export const isGroupMember = (group, memberId) => {
  return (group.members || []).some(
    (groupMemberId) => String(groupMemberId) === String(memberId),
  );
};

export const getGroupOrThrow = async (groupId) => {
  const group = await GroupsModel.findById(groupId);

  if (!group) {
    throw new Error("Group not found");
  }

  return group;
};

export const requireGroupCreatorAccess = async (groupId, ctx) => {
  const memberId = getAuthenticatedMemberId(ctx);
  const group = await getGroupOrThrow(groupId);

  if (!isGroupCreator(group, memberId)) {
    throw new Error("Only the group creator can perform this action.");
  }

  return { group, memberId };
};

export const requireGroupAdminAccess = async (groupId, ctx) => {
  const memberId = getAuthenticatedMemberId(ctx);
  const group = await getGroupOrThrow(groupId);

  if (!isGroupCreator(group, memberId) && !isGroupAdmin(group, memberId)) {
    throw new Error(
      "Only the group creator or an admin can perform this action.",
    );
  }

  return { group, memberId };
};

export const requireGroupMembership = async (groupId, ctx) => {
  const memberId = getAuthenticatedMemberId(ctx);
  const group = await getGroupOrThrow(groupId);

  if (!isGroupMember(group, memberId)) {
    throw new Error(
      "You must be a member of this group to perform this action.",
    );
  }

  return { group, memberId };
};
