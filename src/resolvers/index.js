import memberResolvers from "./members";
import clientResolvers from "./clients";
import contractResolvers from "./contracts";
import Subscription from "./subscriptions";
import chatResolvers from "./chat";
import Query from "./Query";

module.exports = {
  Query: {
    ...Query,
    ...chatResolvers.Query,
  },
  // @todo update imports
  Mutation: {
    ...memberResolvers.Mutation,
    ...clientResolvers.Mutation,
    ...contractResolvers.Mutation,
  },
  Member: {
    ...memberResolvers.Member,
  },
  Client: {
    ...clientResolvers.Client,
  },
  Contract: {
    ...contractResolvers.Contract,
  },
  Subscription: {
    ...chatResolvers.Subscription,
  },
};
