import memberResolvers from './members';
import clientResolvers from './clients';
import contractResolvers from './contracts';
import productResovers from './products';

module.exports = {
  Query: {
    ...clientResolvers.Query,
    ...memberResolvers.Query,
    ...contractResolvers.Query,
    ...productResovers.Query,
  },

  Mutation: {
    ...memberResolvers.Mutation,
    ...clientResolvers.Mutation,
    ...contractResolvers.Mutation,
    ...productResovers.Mutation,
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
