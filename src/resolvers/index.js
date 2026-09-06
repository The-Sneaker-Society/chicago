import memberResolvers from "./members.resolver";
import contractResolvers from "./contracts";
import productResovers from "./products";
import userResolvers from "./users";
import chatResolvers from "./chat/chat";
import imageResolvers from "../photo-upload-service/image.resolvers";
import groupResolvers from "./group";
import clientResolvers from "./clients";

module.exports = {
  Query: {
    ...memberResolvers.Query,
    ...contractResolvers.Query,
    ...productResovers.Query,
    ...userResolvers.Query,
    ...chatResolvers.Query,
    ...imageResolvers.Query,
    ...groupResolvers.Query,
    ...clientResolvers.Query,
  },
  Mutation: {
    ...memberResolvers.Mutation,
    ...contractResolvers.Mutation,
    ...productResovers.Mutation,
    ...userResolvers.Mutation,
    ...chatResolvers.Mutation,
    ...imageResolvers.Mutation,
    ...groupResolvers.Mutation,
    ...clientResolvers.Mutation,
  },
  Member: {
    ...memberResolvers.Member,
  },
  PublicMember: {
    ...memberResolvers.PublicMember,
  },
  Client: {
    ...clientResolvers.Client,
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
    ...groupResolvers.Group,
  },
};
