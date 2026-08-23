import MemberModel from "../models/Member.model";

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

  /**
   * Links a contract (and the owning client) onto the member.
   */
  async pushContractToMember(memberId, contractId, clientId) {
    return await MemberModel.findByIdAndUpdate(memberId, {
      $push: { contracts: contractId, clients: clientId },
    });
  },

  async findMembersByClientId(clientId) {
    return await MemberModel.find({ clients: clientId });
  },
};
