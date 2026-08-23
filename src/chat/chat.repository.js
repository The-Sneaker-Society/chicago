import ChatModel from "../models/Chat.model";
import MessageModel from "../models/Messages.Model";
// TODO(cross-domain): move to UserRepository when users refactor lands
import UserModel from "../models/User.model";
// TODO(cross-domain): move to MemberRepository when members refactor lands
import MemberModel from "../models/Member.model";
// TODO(cross-domain): move to ContractRepository when contracts refactor lands
import ContractModel from "../models/Contract.model";

export const chatRepository = {
  // Chats
  async findChatById(id) {
    return await ChatModel.findById(id);
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

  // Cross-domain reads
  // TODO(cross-domain): move to UserRepository when users refactor lands
  async findUserById(userId) {
    return await UserModel.findById(userId);
  },

  // TODO(cross-domain): move to MemberRepository when members refactor lands
  async findMemberById(memberId) {
    return await MemberModel.findById(memberId);
  },

  // TODO(cross-domain): move to ContractRepository when contracts refactor lands
  async findContractById(contractId) {
    return await ContractModel.findById(contractId);
  },

  // TODO(cross-domain): move to ContractRepository when contracts refactor lands
  async updateContractById(id, updates) {
    return await ContractModel.findByIdAndUpdate(id, updates, { new: true });
  },
};
