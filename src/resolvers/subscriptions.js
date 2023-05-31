import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

const Subscription = {
  numberIncremented: {
    subscribe: () => pubsub.asyncIterator(["NUMBER_INCREMENTED"]),
  },
};

export { Subscription as default };
