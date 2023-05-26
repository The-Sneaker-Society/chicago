import UserModel from "../models/User.model";
import MessageModel from "../models/Message.model";
import { AuthenticationError } from "apollo-server-core";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

const MESSAGE_CREATED = "MESSAGE_CREATED";

const Subscription = {
  messageCreated: {
    subscribe: () => pubsub.asyncIterator([MESSAGE_CREATED]),
  },
};

const Query = {
  messages: async () => {
    try {
      const messages = await MessageModel.find();
      return messages;
    } catch (error) {
      throw new Error("Error retrieving messages");
    }
  },
};

const Mutation = {
  sendMessage: async (_, { text }, { user }) => {
    try {
      if (!user) {
        throw new AuthenticationError("User not authenticated");
      }

      const newMessage = new MessageModel({
        content: text,
        sender: user.id,
      });

      const savedMessage = await newMessage.save();

      pubsub.publish(MESSAGE_CREATED, { messageCreated: savedMessage });

      return savedMessage;
    } catch (error) {
      throw new Error("Error sending message");
    }
  },
};

const Message = {
  sender: async (parent) => {
    try {
      const sender = await UserModel.findById(parent.sender);
      return sender;
    } catch (error) {
      throw new Error("Error retrieving sender");
    }
  },
};

export default {
  Query,
  Mutation,
  Subscription,
  Message,
};
