import { chatRepository } from "./chat.repository.js";
import { createPaymentIntent } from "../stripe/stripe.service";
import { stripe } from "../stripe/config";

const toMessagePayload = (message) => {
  return {
    id: message._id,
    chatId: message.chatId,
    senderId: message.senderId,
    content: message.content,
    senderType: message.senderType,
    type: message.type,
    metadata: message.metadata,
    createdAt: message.createdAt,
  };
};

const toMessageApiShape = (message) => {
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
};

/**
 * Chat & message business logic.
 *
 * Publishing is injected as a `publish(trigger, payload)` callback from the
 * resolver so this layer stays free of transport concerns (pubsub).
 */
export const chatService = {
  /**
   * NOTE: returns every message in the collection unpaginated —
   * preserved behavior; pagination is out of scope for now.
   */
  async getMessages() {
    const messages = await chatRepository.findAllMessages();
    return messages.map(toMessageApiShape);
  },

  async getChatById(chatId) {
    return await chatRepository.findChatById(chatId);
  },

  async createChat(memberId, input) {
    const { userId, name } = input;
    return await chatRepository.createChat({ name, memberId, userId });
  },

  /**
   * Creates a message in an existing chat and publishes MESSAGE_CREATED.
   * Throws CHAT_NOT_FOUND if the chat does not exist.
   */
  async createMessage(senderId, input, publish) {
    const { content, senderType, chatId, type, price, checkoutUrl } = input;

    const chat = await chatRepository.findChatById(chatId);
    if (!chat) {
      throw new Error("CHAT_NOT_FOUND");
    }

    const messageData = {
      senderId,
      content,
      senderType,
      chatId,
      type: type || "TEXT",
    };
    if (type === "PRICE_PROPOSAL") {
      messageData.metadata = { price, checkoutUrl, status: "pending" };
    }

    const newMessage = await chatRepository.createMessage(messageData);

    chat.messages.push(newMessage._id);
    await chatRepository.saveChat(chat);

    publish(`MESSAGE_CREATED ${chatId}`, {
      subscribeToChat: toMessagePayload(newMessage),
    });

    return newMessage;
  },

  /**
   * Proposes a price on a contract's chat:
   * - ownership + chat-existence guards via the contract repository
   * - supersedes previous pending proposals and expires their Stripe sessions
   * - creates the proposal message and publishes MESSAGE_CREATED / MESSAGE_UPDATED
   */
  async proposePriceInChat(memberId, stripeConnectAccountId, contractId, price, publish) {
    const contract = await chatRepository.findContractById(contractId);
    if (!contract) {
      throw new Error("CONTRACT_NOT_FOUND");
    }
    if (contract.memberId.toString() !== memberId.toString()) {
      throw new Error("UNAUTHORIZED_CONTRACT");
    }
    if (!contract.chatId) {
      throw new Error("NO_CHAT_FOR_CONTRACT");
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
    const previousProposals = await chatRepository.findPendingProposals(contract.chatId);
    for (const prev of previousProposals) {
      prev.metadata.status = "superseded";
      await chatRepository.saveMessage(prev);
      if (prev.metadata.checkoutSessionId) {
        try {
          await stripe.checkout.sessions.expire(prev.metadata.checkoutSessionId);
        } catch (e) {
          // Session may already be expired or paid — that's fine
        }
      }
      publish(`MESSAGE_UPDATED ${contract.chatId}`, {
        messageUpdated: toMessagePayload(prev),
      });
    }

    await chatRepository.updateContractById(contractId, {
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

    const newMessage = await chatRepository.createMessage(messageData);

    await chatRepository.updateChatById(contract.chatId, {
      $push: { messages: newMessage._id },
    });

    publish(`MESSAGE_CREATED ${contract.chatId}`, {
      subscribeToChat: toMessagePayload(newMessage),
    });

    return newMessage;
  },

  // Field-resolver helpers
  async getMessagesForChat(chatId) {
    return await chatRepository.findMessagesByChatId(chatId);
  },

  async getUserForChat(userId) {
    return await chatRepository.findUserById(userId);
  },

  async getMemberForChat(memberId) {
    return await chatRepository.findMemberById(memberId);
  },
};
