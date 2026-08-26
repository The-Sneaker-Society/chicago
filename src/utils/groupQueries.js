import GroupsModel from "../models/Groups.model";
import GroupPostModel from "../models/GroupPost.model";

export const getPostAndGroup = async (postId) => {
  const post = await GroupPostModel.findById(postId);

  if (!post) {
    throw new Error("Post not found");
  }

  const group = await GroupsModel.findById(post.groupId);

  if (!group) {
    throw new Error("Group not found");
  }

  return { post, group };
};

export const getPopulatedGroup = async (groupId) => {
  return GroupsModel.findById(groupId)
    .populate("members")
    .populate("createdBy")
    .populate("admins");
};

export const getPopulatedPost = async (postId) => {
  return GroupPostModel.findById(postId)
    .populate("author")
    .populate("likes")
    .populate("comments.author");
};
