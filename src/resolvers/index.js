import memberResolvers from "./members";
import clientResolvers from "./clients";
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
};
