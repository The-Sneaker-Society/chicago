import { UserInputError } from "apollo-server-core";

import { chatService } from "../../chat/chat.service.js";
import { chatErrors } from "../../chat/chat.constants.js";
import { requireAuth, requireMember } from "../../auth/guards.js";

import pubsub from "../../pubsub";

const publish = (trigger, payload) => pubsub.publish(trigger, payload);

const Query = {
  messages: requireAuth(async (parent, args, ctx, info) => {
    try {
      return await chatService.getMessages();
    } catch (e) {
      throw e;
    }
  }),
  getChatById: requireAuth(async (parent, args, ctx, info) => {
    try {
      const { chatId } = args;
      return await chatService.getChatById(chatId, ctx.dbUser?._id);
    } catch (e) {
      if (e.message === chatErrors.CHAT_NOT_FOUND) {
        throw new UserInputError(" Chat does not exist");
      }
      throw e;
    }
  }),
};

const Mutation = {
  createChat: requireMember(async (parent, args, ctx, info) => {
    try {
      const { _id } = ctx.dbUser;
      await chatService.createChat(_id, args.data);
      return true;
    } catch (e) {
      throw e;
    }
  }),
  createMessage: requireMember(async (parent, args, ctx, info) => {
    try {
      const { _id } = ctx.dbUser;
      return await chatService.createMessage(_id, args.data, publish);
    } catch (e) {
      if (e.message === chatErrors.CHAT_NOT_FOUND) {
        throw new UserInputError(" Chat does not exist");
      }
      throw e;
    }
  }),
  proposePriceInChat: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId, price } = args;
      const memberId = ctx.dbUser._id;

      const stripeConnectAccountId = ctx.dbUser?.stripeConnectAccountId;
      if (!stripeConnectAccountId) {
        throw new Error("Stripe account not connected");
      }

      return await chatService.proposePriceInChat(
        memberId,
        stripeConnectAccountId,
        contractId,
        price,
        publish
      );
    } catch (e) {
      if (e.message === "CONTRACT_NOT_FOUND") {
        throw new Error("Contract not found");
      }
      if (e.message === "UNAUTHORIZED_CONTRACT") {
        throw new Error("Unauthorized: Contract does not belong to this member");
      }
      if (e.message === "NO_CHAT_FOR_CONTRACT") {
        throw new Error("No chat exists for this contract");
      }
      throw new Error(e);
    }
  }),
};

const Chat = {
  async messages(parent, args, ctx, info) {
    try {
      const { id: chatId } = parent;
      return await chatService.getMessagesForChat(chatId, ctx.dbUser?._id);
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  },
  async user(parent, args, ctx, info) {
    try {
      return await chatService.getUserForChat(parent.userId);
    } catch (e) {
      throw new Error(e);
    }
  },

  async member(parent, args, ctx, info) {
    try {
      return await chatService.getMemberForChat(parent.memberId);
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Subscription = {
  subscribeToChat: {
    subscribe: (parent, args, ctx, info) => {
      const { chatId } = args.data;
      return pubsub.asyncIterator([`MESSAGE_CREATED ${chatId}`]);
    },
  },
  messageUpdated: {
    subscribe: (parent, args, ctx, info) => {
      const { chatId } = args.data;
      return pubsub.asyncIterator([`MESSAGE_UPDATED ${chatId}`]);
    },
  },
};

export default { Query, Mutation, Chat, Subscription };
