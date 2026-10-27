import VaultModel from "../models/Vault.model";

// Sole owner of all Vault DB access. No validation or business rules here.
export const vaultRepository = {
  findByMember(memberId) {
    return VaultModel.find({ memberId, deletedAt: null }).sort({ createdAt: -1 });
  },

  findActiveById(id) {
    return VaultModel.findOne({ _id: id, deletedAt: null });
  },

  findById(id) {
    return VaultModel.findById(id);
  },

  async queue({ status, limit, offset }) {
    const filter = { deletedAt: null };
    if (status) filter.status = status;
    const [totalCount, items] = await Promise.all([
      VaultModel.countDocuments(filter),
      VaultModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
    ]);
    return { totalCount, items };
  },

  create(doc) {
    return VaultModel.create(doc);
  },

  updateById(id, updates) {
    return VaultModel.findByIdAndUpdate(id, updates, { new: true });
  },

  softDelete(id) {
    return VaultModel.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true });
  },
};
