import { chatRepository } from "./chat.repository.js";
import { contractRepository } from "../contracts/contract.repository.js";
import { memberRepository } from "../members/member.repository.js";
import { userRepository } from "../users/user.repository.js";
import { createPaymentIntent } from "../stripe/stripe.service";
import { stripe } from "../stripe/config";
import {
  contractStatus,
  timelineEvent,
} from "../contracts/contract.constants.js";
import { chatErrors } from "./chat.constants.js";

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

  /**
   * Participant-scoped read: a chat that isn't yours looks identical to one
   * that doesn't exist (NOT_FOUND-not-FORBIDDEN doctrine).
   */
  async getChatById(chatId, requesterDbId) {
    // No db row (e.g. admin) ⇒ can never be a participant.
    const chat = requesterDbId
      ? await chatRepository.findChatByIdForParticipant(chatId, requesterDbId)
      : null;
    if (!chat) {
      throw new Error(chatErrors.CHAT_NOT_FOUND);
    }
    return chat;
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
      throw new Error(chatErrors.CHAT_NOT_FOUND);
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
    const contract = await contractRepository.findById(contractId);
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

    await contractRepository.updateById(contractId, {
      proposedPrice: price,
      status: contractStatus.priceProposed,
      $push: { timeline: { event: timelineEvent.priceProposed, date: new Date() } },
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
  /**
   * Gates message reads through the same participant-scoped fetch as
   * getChatById so messages of a foreign chat are NOT_FOUND, not leaked.
   */
  async getMessagesForChat(chatId, requesterDbId) {
    // No db row (e.g. admin) ⇒ can never be a participant.
    const chat = requesterDbId
      ? await chatRepository.findChatByIdForParticipant(chatId, requesterDbId)
      : null;
    if (!chat) {
      throw new Error(chatErrors.CHAT_NOT_FOUND);
    }
    return await chatRepository.findMessagesByChatId(chatId);
  },

  async getUserForChat(userId) {
    return await userRepository.findById(userId);
  },

  async getMemberForChat(memberId) {
    return await memberRepository.findById(memberId);
  },
};
