import memberResolvers from './members';
import clientResolvers from './clients';
import contractResolvers from './contracts';

module.exports = {
  Query: {
    ...clientResolvers.Query,
    ...memberResolvers.Query,
    ...contractResolvers.Query,
  },

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
};
