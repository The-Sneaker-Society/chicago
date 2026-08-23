import ContractModel from "../models/Contract.model";
// TODO(cross-domain): move to MemberRepository when members refactor lands
import MemberModel from "../models/Member.model";
// TODO(cross-domain): move to UserRepository when users refactor lands
import UserModel from "../models/User.model";
// TODO(cross-domain): move to ChatRepository when chat refactor lands
import ChatModel from "../models/Chat.model";

export const contractRepository = {
  async findAll(filter = {}) {
    return await ContractModel.find(filter);
  },

  async findById(id) {
    return await ContractModel.findById(id);
  },

  async findByIds(ids) {
    return await ContractModel.find({ _id: { $in: ids } });
  },

  async findByClient(clientId) {
    return await ContractModel.find({ clientId });
  },

  async create(data) {
    const contract = new ContractModel(data);
    return await contract.save();
  },

  async updateById(id, updates, options = {}) {
    return await ContractModel.findByIdAndUpdate(id, updates, options);
  },

  /**
   * Persists a mutated document (used by flows that edit nested paths
   * directly on the loaded doc before saving).
   */
  async save(doc) {
    return await doc.save();
  },

  async aggregateByMemberStatus(memberId) {
    return await ContractModel.aggregate([
      { $match: { memberId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);
  },

  async findPendingPayoutsByMember(memberId) {
    return await ContractModel.aggregate([
      { $match: { memberId, payoutStatus: "pending" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$payoutAmount" },
          count: { $sum: 1 },
          totalFees: { $sum: "$platformFee" },
          totalGross: { $sum: "$proposedPrice" },
        },
      },
    ]);
  },

  async findLatestPaidByMember(memberId) {
    return await ContractModel.findOne(
      { memberId, payoutStatus: "paid" },
      { payoutAmount: 1 },
      { sort: { paidAt: -1 } }
    );
  },

  // TODO(cross-domain): move to MemberRepository when members refactor lands
  async findMemberById(memberId) {
    return await MemberModel.findById(memberId);
  },

  // TODO(cross-domain): move to MemberRepository when members refactor lands
  async pushContractToMember(memberId, contractId, clientId) {
    return await MemberModel.findByIdAndUpdate(memberId, {
      $push: { contracts: contractId, clients: clientId },
    });
  },

  // TODO(cross-domain): move to UserRepository when users refactor lands
  async findUserById(userId) {
    return await UserModel.findById(userId);
  },

  // TODO(cross-domain): move to UserRepository when users refactor lands
  async pushContractToUser(userId, contractId, memberId) {
    return await UserModel.findByIdAndUpdate(userId, {
      $push: { contracts: contractId },
      $addToSet: { members: memberId },
    });
  },

  // TODO(cross-domain): move to ChatRepository when chat refactor lands
  async findChatById(chatId) {
    return await ChatModel.findById(chatId);
  },

  // TODO(cross-domain): move to ChatRepository when chat refactor lands
  async createChat(data) {
    const chat = new ChatModel(data);
    return await chat.save();
  },
};
