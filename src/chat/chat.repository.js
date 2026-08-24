import ChatModel from "../models/Chat.model";
import MessageModel from "../models/Messages.Model";

export const chatRepository = {
  // Chats
  async findChatById(id) {
    return await ChatModel.findById(id);
  },

  /**
   * Participant-scoped read: matches only when the requester is one of the
   * chat's two parties. Backs the NOT_FOUND-not-FORBIDDEN scoping doctrine
   * for id-based reads.
   */
  async findChatByIdForParticipant(chatId, participantDbId) {
    return await ChatModel.findOne({
      _id: chatId,
      $or: [{ userId: participantDbId }, { memberId: participantDbId }],
    });
  },

  async createChat(data) {
    return await ChatModel.create(data);
  },

  async updateChatById(id, updates) {
    return await ChatModel.findByIdAndUpdate(id, updates, { new: true });
  },

  async saveChat(doc) {
    return await doc.save();
  },

  // Messages
  async findAllMessages() {
    return await MessageModel.find();
  },

  async findMessagesByChatId(chatId) {
    return await MessageModel.find({ chatId }).sort({ createdAt: 1 });
  },

  async findPendingProposals(chatId) {
    return await MessageModel.find({
      chatId,
      type: "PRICE_PROPOSAL",
      "metadata.status": "pending",
    });
  },

  async createMessage(data) {
    return await MessageModel.create(data);
  },

  async saveMessage(doc) {
    return await doc.save();
  },

  async findChatsByMemberId(memberId) {
    return await ChatModel.find({ memberId });
  },
};
