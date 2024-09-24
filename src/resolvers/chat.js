import MessageModel from "../models/Messages.Model";
import UserModel from "../models/User.model";
import MemberModel from "../models/Member.model";
import ChatModel from "../models/Chat.model";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

const Query = {
  // newMessage() {
  //   const date = Date.now();
  //   const dateString = new Date(date);

  //   return {
  //     user: "Alanis Yates",
  //     text: `Message + num:${currentNumber}`,
  //     timeStamp: dateString.toDateString(),
  //   };
  // },
  async messages() {
    try {
      const messages = await MessageModel.find();

      return messages.map((message) => {
        return {
          id: message._id,
          chatId: message.chatId,
          senderId: message.senderId,
          content: message.content,
          senderType: message.senderType,
          createdAt: new Date(message.createdAt),
        };
      });
    } catch (e) {
      throw e;
    }
  },
  async getChatById(parent, args, ctx, info) {
    try {
      const { chatId } = args;
      const foundChat = await ChatModel.findById(chatId);
      return foundChat;
    } catch (e) {
      throw e;
    }
  },
};

const Mutation = {
  async createChat(parent, args, ctx, info) {
    try {
      const { _id } = ctx;
      const { userId, name } = args.data;

      const newChat = ChatModel({ name, memberId: _id, userId });

      await newChat.save();

      return true;
    } catch (e) {
      throw e;
    }
  },
  async createMessage(parent, args, ctx, info) {
    try {
      const { _id } = ctx;
      const { content, senderType, chatId } = args.data;

      const chat = await ChatModel.findById(chatId);

      if (chat) {
        const newMessage = new MessageModel({
          senderId: _id,
          content,
          senderType,
          chatId,
        });

        const res = await newMessage.save();

        chat.messages.push(res._id);

        await chat.save();

        pubsub.publish(`MESSAGE_CREATED ${chatId}`, {
          subscribeToChat: {
            id: res._id,
            chatId: res.chatId,
            senderId: res._id,
            content: res.content,
            senderType: res.senderType,
            createdAt: new Date(res.createdAt),
          },
        });

        return res;
      } else {
        throw new UserInputError(" Chat does not exist");
      }
    } catch (e) {
      throw e;
    }
  },
};

const Chat = {
  async messages(parent, args, ctx, info) {
    try {
      const messages = await MessageModel.find({ chatId: parent.id });
      return messages;
    } catch (e) {
      throw e;
    }
  },
  async user(parent, args, ctx, info) {
    try {
      const user = await UserModel.findById(parent.userId);

      return user;
    } catch (e) {
      throw new Error(e);
    }
  },

  async member(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(parent.memberId);

      return member;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Subscription = {
  // numberIncremented: {
  //   subscribe: () => pubsub.asyncIterator(['NUMBER_INCREMENTED']),
  // },
  subscribeToChat: {
    subscribe: (partent, args, ctx, ibfo) => {
      const { chatId } = args.data;
      return pubsub.asyncIterator([`MESSAGE_CREATED ${chatId}`]);
    },
  },
};

export default { Query, Mutation, Chat, Subscription };
