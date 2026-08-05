import MessageModel from "../../models/Messages.Model";
import UserModel from "../../models/User.model";
import MemberModel from "../../models/Member.model";
import ChatModel from "../../models/Chat.model";
import ContractModel from "../../models/Contract.model";
import { createPaymentIntent } from "../../stripe/stripe.service";
import { stripe } from "../../stripe/config";
import pubsub from "../../pubsub";

const Query = {
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
          type: message.type || "TEXT",
          metadata: message.metadata,
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
      const { _id } = ctx.dbUser;
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
      const { _id } = ctx.dbUser;
      const { content, senderType, chatId, type, price, checkoutUrl } = args.data;

      const chat = await ChatModel.findById(chatId);

      if (chat) {
        const messageData = {
          senderId: _id,
          content,
          senderType,
          chatId,
          type: type || "TEXT",
        };
        if (type === "PRICE_PROPOSAL") {
          messageData.metadata = { price, checkoutUrl, status: "pending" };
        }

        const newMessage = new MessageModel(messageData);

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
            type: res.type,
            metadata: res.metadata,
            createdAt: res.createdAt,
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
  async proposePriceInChat(parent, args, ctx, info) {
    try {
      const { contractId, price } = args;
      const memberId = ctx.dbUser?._id;

      if (!memberId) {
        throw new Error("Unauthorized");
      }

      const contract = await ContractModel.findById(contractId);
      if (!contract) {
        throw new Error("Contract not found");
      }
      if (contract.memberId.toString() !== memberId.toString()) {
        throw new Error("Unauthorized: Contract does not belong to this member");
      }

      if (!contract.chatId) {
        throw new Error("No chat exists for this contract");
      }

      const stripeConnectAccountId = ctx.dbUser?.stripeConnectAccountId;
      if (!stripeConnectAccountId) {
        throw new Error("Stripe account not connected");
      }

      const brand = contract.shoeDetails?.brand || "";
      const model = contract.shoeDetails?.model || "";
      const shoeLabel = [brand, model].filter(Boolean).join(" ") || "Sneaker";
      const productName = `Sneaker Society - ${shoeLabel}`;

      const checkoutSession = await createPaymentIntent(
        stripeConnectAccountId,
        price,
        contractId,
        productName
      );
      const { url: checkoutUrl, id: checkoutSessionId, expiresAt } = checkoutSession;

      // Expire any previous pending proposals for this contract
      const previousProposals = await MessageModel.find({
        chatId: contract.chatId,
        type: "PRICE_PROPOSAL",
        "metadata.status": "pending",
      });
      for (const prev of previousProposals) {
        prev.metadata.status = "superseded";
        await prev.save();
        if (prev.metadata.checkoutSessionId) {
          try {
            await stripe.checkout.sessions.expire(prev.metadata.checkoutSessionId);
          } catch (e) {
            // Session may already be expired or paid — that's fine
          }
        }
        pubsub.publish(`MESSAGE_UPDATED ${contract.chatId}`, {
          messageUpdated: {
            id: prev._id,
            chatId: prev.chatId,
            senderId: prev.senderId,
            content: prev.content,
            senderType: prev.senderType,
            type: prev.type,
            metadata: prev.metadata,
            createdAt: prev.createdAt,
          },
        });
      }

      await ContractModel.findByIdAndUpdate(contractId, {
        proposedPrice: price,
        status: "PRICE_PROPOSED",
        $push: { timeline: { event: "PRICE_PROPOSED", date: new Date() } },
      });

      const messageData = {
        senderId: memberId,
        content: `Price proposal: $${price}`,
        senderType: "MEMBER",
        chatId: contract.chatId,
        type: "PRICE_PROPOSAL",
        metadata: { price, checkoutUrl, checkoutSessionId, expiresAt, status: "pending" },
      };

      const newMessage = new MessageModel(messageData);
      const res = await newMessage.save();

      await ChatModel.findByIdAndUpdate(contract.chatId, {
        $push: { messages: res._id },
      });

      pubsub.publish(`MESSAGE_CREATED ${contract.chatId}`, {
        subscribeToChat: {
          id: res._id,
          chatId: res.chatId,
          senderId: res.senderId,
          content: res.content,
          senderType: res.senderType,
          type: res.type,
          metadata: res.metadata,
          createdAt: res.createdAt,
        },
      });

      return res;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Chat = {
  async messages(parent, args, ctx, info) {
    try {
      const { id: chatId } = parent;

      const messages = await MessageModel.find({ chatId }).sort({
        createdAt: 1,
      });

      return messages;
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
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
