import { UserInputError } from 'apollo-server-core';
import { getMemberSubscription } from '../stripe/subscriptions/subscriptionUtils';

const Query = {
  stripe: async (parrent, args, ctx, info) => {
    try {
      const status = await getMemberSubscription();
      return { status: status };
    } catch (error) {
      throw error;
    }
  },
};

export default { Query };
