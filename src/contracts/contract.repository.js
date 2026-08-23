import ContractModel from "../models/Contract.model";

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

  async findContractsByIdsSince(contractIds, sinceDate) {
    return await ContractModel.find({
      _id: { $in: contractIds },
      createdAt: { $gte: sinceDate },
    }).sort({ createdAt: 1 });
  },
};
