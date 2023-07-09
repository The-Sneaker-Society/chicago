import { PubSub } from 'graphql-subscriptions';
import MessageModel from '../models/Messages.model';
import ChatModel from '../models/Chat.model';
import { UserInputError } from 'apollo-server-core';
import MemberModel from '../models/Member.model';
import ClientModel from '../models/Client.model';

const pubsub = new PubSub();

const Query = {
  currentNumber() {
    return currentNumber;
  },
  newMessage() {
    const date = Date.now();
    const dateString = new Date(date);

    return {
      user: 'Alanis Yates',
      text: `Message + num:${currentNumber}`,
      timeStamp: dateString.toDateString(),
    };
  },
  async messages() {
    try {
      const messages = await MessageModel.find();

      return messages.map((message) => {
        return {
          id: message._id,
          chatId: message.chatId,
          senderId: message.senderId,
          content: message.content,
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
      const { name, memberId, clientId } = args.data;

      //create the chat model
      const newChat = ChatModel({ name, memberId, clientId });

      const res = await newChat.save();
      return res;
    } catch (e) {
      throw e;
    }
  },
  async createMessage(parent, args, ctx, info) {
    try {
      const { content, senderId, senderType, chatId } = args.data;

      const chat = await ChatModel.findById(chatId);

      if (chat) {
        const newMessage = new MessageModel({
          senderId,
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
            senderId: res.senderId,
            content: res.content,
            senderType: res.senderType,
            createdAt: new Date(res.createdAt),
          },
        });

        return res;
      } else {
        throw new UserInputError(' Chat does not exist');
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
  async member(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(parent.memberId.toString());
      return member;
    } catch (e) {
      throw new Error(e);
    }
  },
  async client(parent, args, ctx, info) {
    try {
      const client = await ClientModel.findById(parent.clientId.toString());
      return client;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Subscription = {
  numberIncremented: {
    subscribe: () => pubsub.asyncIterator(['NUMBER_INCREMENTED']),
  },
  subscribeToChat: {
    subscribe: (partent, args, ctx, ibfo) => {
      const { chatId } = args.data;
      return pubsub.asyncIterator([`MESSAGE_CREATED ${chatId}`]);
    },
  },
};

export default { Query, Subscription, Mutation, Chat };
