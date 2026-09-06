import ContractModel from "../models/Contract.model";

export const contractRepository = {
  async findAll(filter = {}) {
    return await ContractModel.find(filter);
  },

  async findById(id) {
    return await ContractModel.findById(id);
  },

  /**
   * Party-scoped read: matches only when the requester is the client or the
   * member on the contract. Backs the NOT_FOUND-not-FORBIDDEN scoping
   * doctrine for id-based reads.
   */
  async findByIdForParty(id, partyDbId) {
    return await ContractModel.findOne({
      _id: id,
      $or: [{ clientId: partyDbId }, { memberId: partyDbId }],
    });
  },

  async findByOrderRef(orderRef) {
    if (!orderRef) return null;
    return await ContractModel.findOne({ orderRef });
  },

  /**
   * Party-scoped orderRef lookup: backs the human-readable contract URLs.
   * Non-parties see nothing (NOT_FOUND-not-FORBIDDEN doctrine).
   */
  async findByOrderRefForParty(orderRef, partyDbId) {
    if (!orderRef || !partyDbId) return null;
    return await ContractModel.findOne({
      orderRef,
      $or: [{ clientId: partyDbId }, { memberId: partyDbId }],
    });
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

  /**
   * Party-scoped mutation helper for the client-side Review & Protect flow:
   * persists the chosen preset/speed plus the server-computed fees so
   * Stripe and the DB share the same source of truth.
   */
  async saveShippingSelection(id, { shippingPreset, shippingSpeed, shippingFee, insuranceFee }) {
    return await ContractModel.findByIdAndUpdate(id, {
      shippingPreset,
      shippingSpeed,
      shippingFee,
      insuranceFee,
    });
  },

  /**
   * Manual-review queue for escrow disputes (plan-escrow-dispute.md §2,
   * consumed by the #11 adjudication UI). Frozen payouts only — no rules.
   */
  async findFlagged() {
    return await ContractModel.find({ status: "UNDER_MANUAL_REVIEW" });
  },

  /**
   * 72h auto-payout eligibility (plan-escrow-dispute.md §4): delivered,
   * payout still pending, and the review window has elapsed. Rows with no
   * payoutEligibleAt (webhook backfill gap) are never auto-paid.
   */
  async findPayoutDue(now) {
    return await ContractModel.find({
      status: "DELIVERED_TO_USER",
      payoutStatus: "pending",
      payoutEligibleAt: { $lte: now },
    });
  },
};
