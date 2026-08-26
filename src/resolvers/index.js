import memberResolvers from "./members.resolver";
import contractResolvers from "./contracts";
import productResovers from "./products";
import userResolvers from "./users";
import chatResolvers from "./chat/chat";
import imageResolvers from "../photo-upload-service/image.resolvers";
import groupResolvers from "./group";
import groupPostResolvers from "./groupPost";
import commentResolvers from "./comment";

module.exports = {
  Query: {
    ...memberResolvers.Query,
    ...contractResolvers.Query,
    ...productResovers.Query,
    ...userResolvers.Query,
    ...chatResolvers.Query,
    ...imageResolvers.Query,
    ...groupResolvers.Query,
    ...groupPostResolvers.Query,
  },
  Mutation: {
    ...memberResolvers.Mutation,
    ...contractResolvers.Mutation,
    ...productResovers.Mutation,
    ...userResolvers.Mutation,
    ...chatResolvers.Mutation,
    ...imageResolvers.Mutation,
    ...groupResolvers.Mutation,
    ...groupPostResolvers.Mutation,
    ...commentResolvers.Mutation,
  },
  Member: {
    ...memberResolvers.Member,
  },
  Chat: {
    ...chatResolvers.Chat,
  },
  User: {
    ...userResolvers.User,
  },
  Contract: {
    ...contractResolvers.Contract,
  },
  Subscription: {
    ...chatResolvers.Subscription,
  },
  Group: {
    ...(groupResolvers.Group || {}),
  },
  GroupPost: {
    ...groupPostResolvers.Post,
  },
};
