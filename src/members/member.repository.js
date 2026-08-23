import MemberModel from "../models/Member.model";

// TODO(cross-domain): move to ContractRepository when contracts refactor lands
import ContractModel from "../models/Contract.model";
// TODO(cross-domain): move to ChatRepository when chat refactor lands
import ChatModel from "../models/Chat.model";
// TODO(cross-domain): move to UserRepository when users findByIds lands
import UserModel from "../models/User.model";
// TODO(cross-domain): move to ProductRepository when products refactor lands
import ProductsModel from "../models/Products.model";

export const memberRepository = {
  async findAll() {
    return await MemberModel.find();
  },

  async findByClerkId(clerkId) {
    return await MemberModel.findOne({ clerkId });
  },

  async findById(id) {
    return await MemberModel.findById(id);
  },

  async create(data) {
    return await MemberModel.create(data);
  },

  async save(doc) {
    return await doc.save();
  },

  async updateById(id, updates = {}) {
    return await MemberModel.findByIdAndUpdate(id, updates, { new: true });
  },

  /**
   * Executes an arbitrary aggregation pipeline against MemberModel.
   * Pipeline/stage building (scoring etc.) lives in the service.
   */
  async aggregate(pipeline) {
    return await MemberModel.aggregate(pipeline);
  },

  /**
   * Keeps both sides of the follow graph in sync in parallel.
   * mode: "follow" ($addToSet) | "unfollow" ($pull)
   */
  async addFollowerIds(currentId, targetId, mode) {
    const operator = mode === "follow" ? "$addToSet" : "$pull";
    await Promise.all([
      MemberModel.findByIdAndUpdate(currentId, {
        [operator]: { following: targetId },
      }),
      MemberModel.findByIdAndUpdate(targetId, {
        [operator]: { followers: currentId },
      }),
    ]);
  },

  async findMembersByIds(ids, projection) {
    return await MemberModel.find({ _id: { $in: ids } }).select(projection);
  },

  // TODO(cross-domain): move to ContractRepository when contracts refactor lands
  async sumPendingPayouts(memberId) {
    return await ContractModel.aggregate([
      { $match: { memberId: memberId, payoutStatus: "pending" } },
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

  // TODO(cross-domain): move to ContractRepository when contracts refactor lands
  async findLastPaidContract(memberId) {
    return await ContractModel.findOne(
      { memberId: memberId, payoutStatus: "paid" },
      { payoutAmount: 1 },
      { sort: { paidAt: -1 } }
    );
  },

  // TODO(cross-domain): move to ContractRepository when contracts refactor lands
  async findContractsByIdsSince(contractIds, sinceDate) {
    return await ContractModel.find({
      _id: { $in: contractIds },
      createdAt: { $gte: sinceDate },
    }).sort({ createdAt: 1 });
  },

  // TODO(cross-domain): move to ContractRepository when contracts refactor lands
  async findContractsByIds(contractIds) {
    return await ContractModel.find({ _id: { $in: contractIds } });
  },

  // TODO(cross-domain): move to ChatRepository when chat refactor lands
  async findChatsByMemberId(memberId) {
    return await ChatModel.find({ memberId });
  },

  // TODO(cross-domain): move to ProductRepository when products refactor lands
  async findProductsByMemberId(memberId) {
    return await ProductsModel.find({ member: memberId });
  },

  // TODO(cross-domain): move to UserRepository when users refactor adds findByIds
  async findUsersByIds(userIds) {
    return await UserModel.find({ _id: { $in: userIds } });
  },
};
