import memberResolvers from "./members";
import clientResolvers from "./clients";

module.exports = {
  Query: {
    ...memberResolvers.Query,
  },
  Mutation: {
    ...memberResolvers.Mutation,
    ...clientResolvers.Mutation,
  },
};
