import memberResolvers from "./members";
import clientResolvers from "./clients";
import contractResolvers from "./contracts";
import ServiceResolver from "./services";
import Query from "./Query";
//adding comment to push new PR

module.exports = {
  Query,
  // @todo update imports
  Mutation: {
    ...memberResolvers.Mutation,
    ...clientResolvers.Mutation,
    ...contractResolvers.Mutation,
    ...ServiceResolver.Mutation,
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
};
