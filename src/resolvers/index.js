import memberResolvers from "./members";
import clientResolvers from "./clients";
import contractResolvers from './contracts'
import Query from "./Query";

module.exports = {
  Query,
  // @todo update imports
  Mutation: {
    ...memberResolvers.Mutation,
    ...clientResolvers.Mutation,
  },
  Member: {
    ...memberResolvers.Member,
  },
  Client: {
    ...clientResolvers.Client,
  },
  Contract: {
    ...contractResolvers.Contract
  }
};
