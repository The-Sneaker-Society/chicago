import memberResolvers from './members';
import clientResolvers from './clients';
import contractResolvers from './contracts';
import chatResolvers from './chat';
import Query from './Query';

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
    ...chatResolvers.Mutation,
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
  Chat: {
    ...chatResolvers.Chat,
  },
  Subscription: {
    ...chatResolvers.Subscription,
  },
};
