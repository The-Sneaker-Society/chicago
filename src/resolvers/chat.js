import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

let currentNumber = 0;

function incrementNumber() {
  currentNumber++;
  pubsub.publish("NUMBER_INCREMENTED", {
    numberIncremented: currentNumber,
  });
  setTimeout(incrementNumber, 1000);
}

// Start incrementing
incrementNumber();

const Query = {
  currentNumber() {
    return currentNumber;
  },
  newMessage() {
    const date = Date.now();
    const dateString = new Date(date);

    return {
      user: "Alanis Yates",
      text: `Message + num:${currentNumber}`,
      timeStamp: dateString.toDateString(),
    };
  },
};

const Mutation = {};

const Subscription = {
  numberIncremented: {
    subscribe: () => pubsub.asyncIterator(["NUMBER_INCREMENTED"]),
  },
};

export default { Query, Subscription };
