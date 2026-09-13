import MemberLedgerEntryModel from "../models/MemberLedgerEntry.model";
import { ledgerEntryStatus } from "./member-ledger.constants";

export const memberLedgerRepository = {
  async create(data) {
    return await MemberLedgerEntryModel.create(data);
  },

  async findById(id) {
    return await MemberLedgerEntryModel.findById(id);
  },

  // Oldest outstanding first — settlement is FIFO.
  async findOutstandingByMember(memberId) {
    return await MemberLedgerEntryModel.find({
      memberId,
      status: ledgerEntryStatus.outstanding,
    }).sort({ createdAt: 1 });
  },

  async findAllByMember(memberId) {
    return await MemberLedgerEntryModel.find({ memberId }).sort({ createdAt: -1 });
  },

  async outstandingBalanceCents(memberId) {
    const entries = await this.findOutstandingByMember(memberId);
    return (entries || []).reduce(
      (sum, e) => sum + (Number(e.amountCents) || 0) - (Number(e.settledCents) || 0),
      0
    );
  },

  async markSettled(id, settledCents) {
    return await MemberLedgerEntryModel.findByIdAndUpdate(
      id,
      { settledCents, status: ledgerEntryStatus.settled },
      { new: true, runValidators: true }
    );
  },

  // Conditional variants for payout-time commits: only apply when settledCents
  // hasn't moved underneath the plan (concurrent payout guard). Returns null
  // on mismatch — callers must treat null as a concurrency abort, not a skip.
  async settleIfExpected(id, expectedSettled, settledCents) {
    return await MemberLedgerEntryModel.findOneAndUpdate(
      { _id: id, settledCents: expectedSettled },
      { settledCents, status: ledgerEntryStatus.settled },
      { new: true }
    );
  },

  async partialIfExpected(id, expectedSettled, settledCents) {
    return await MemberLedgerEntryModel.findOneAndUpdate(
      { _id: id, settledCents: expectedSettled },
      { settledCents, status: ledgerEntryStatus.outstanding },
      { new: true }
    );
  },

  async applyPartial(id, settledCents) {
    return await MemberLedgerEntryModel.findByIdAndUpdate(
      id,
      { settledCents, status: ledgerEntryStatus.outstanding },
      { new: true, runValidators: true }
    );
  },

  async writeOff(id) {
    return await MemberLedgerEntryModel.findByIdAndUpdate(
      id,
      { status: ledgerEntryStatus.writtenOff },
      { new: true, runValidators: true }
    );
  },
};
