import memberResolvers from "./members";
import clientResolvers from "./clients";
import contractResolvers from "./contracts";
import productResolvers from "./products";
import Query from "./Query";

module.exports = {
  Query,
  // @todo update imports
  Mutation: {
    ...memberResolvers.Mutation,
    ...clientResolvers.Mutation,
    ...contractResolvers.Mutation,
    ...productResolvers.Mutation,
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
  Product: {
    ...productResolvers.Product,
  },
};
