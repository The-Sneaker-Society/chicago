import memberResolvers from "./members";
import contractResolvers from "./contracts";
import productResovers from "./products";
import userResolvers from "./users";

module.exports = {
  Query: {
    ...memberResolvers.Query,
    ...contractResolvers.Query,
    ...productResovers.Query,
    ...userResolvers.Query,
  },

  Mutation: {
    ...memberResolvers.Mutation,
    ...contractResolvers.Mutation,
    ...productResovers.Mutation,
    ...userResolvers.Mutation,
  },
  Member: {
    ...memberResolvers.Member,
  },

  User: {
    ...userResolvers.User,
  },
  Contract: {
    ...contractResolvers.Contract,
  },
};
