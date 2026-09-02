import mongoose from "mongoose";
import { createPaymentIntent, releasePayoutToMember } from "../stripe/stripe.service";
import { contractRepository } from "./contract.repository.js";
import { memberRepository } from "../members/member.repository.js";
import { userRepository } from "../users/user.repository.js";
import { chatRepository } from "../chat/chat.repository.js";
import {
  contractStatus,
  payoutStatus,
  contractEvent,
  timelineEvent,
  statusToKey,
  contractErrors,
  platformFee,
} from "./contract.constants.js";

// Mongo status value -> camelCase response key, derived so it can never
// drift out of sync with contractStatus.
const STAGE_MAP = statusToKey;

const EMPTY_STATUS_COUNTS = Object.fromEntries(
  Object.keys(contractStatus).map((key) => [key, 0])
);

const buildShoeProductName = (shoeDetails) => {
  const brand = shoeDetails?.brand || "";
  const model = shoeDetails?.model || "";
  const shoeLabel = [brand, model].filter(Boolean).join(" ") || "Sneaker";
  return `Sneaker Society - ${shoeLabel}`;
};

export const contractService = {
  async getContractsForContext(dbUser, role) {
    if (!dbUser) {
      return [];
    }

    const filter = {};
    if (role === "member") {
      filter.memberId = dbUser._id;
    } else if (role === "client") {
      filter.clientId = dbUser._id;
    }

    return await contractRepository.findAll(filter);
  },

  /**
   * Party-scoped read: a contract you're not a party to looks identical to
   * one that doesn't exist (NOT_FOUND-not-FORBIDDEN doctrine).
   */
  async getContractById(id, requesterDbId) {
    const contract = requesterDbId
      ? await contractRepository.findByIdForParty(id, requesterDbId)
      : null;
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    return contract;
  },

  /**
   * Per-status contract counts for a member. The raw memberId string is
   * passed straight through — Mongo casts it, no ObjectId coercion needed.
   */
  async getMemberContractStatus(memberId) {
    const contractCounts = await contractRepository.aggregateByMemberStatus(
      memberId
    );

    const statusCounts = { ...EMPTY_STATUS_COUNTS };

    contractCounts.forEach((stage) => {
      const statusKey = STAGE_MAP[stage._id];
      if (statusKey) {
        statusCounts[statusKey] = stage.count;
      }
    });

    return statusCounts;
  },

  async getContractList(contractIds) {
    const contracts = await contractRepository.findByIds(contractIds);

    return contracts.map((contract) => ({
      id: contract._id,
      name: `${contract.shoeDetails.brand} ${contract.shoeDetails.model}`,
      status: contract.status,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    }));
  },

  /**
   * Creates a contract with defaults and links it to both the client user
   * and the member. Throws MEMBER_NOT_FOUND when the target member is missing.
   */
  async createContract(clientId, input) {
    const { memberId, shoeDetails, repairDetails, declaredMarketValue, boxIncluded, selectedServiceMenuItem } = input;

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      throw new Error(contractErrors.INVALID_MEMBER_ID);
    }

    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new Error(contractErrors.MEMBER_NOT_FOUND);
    }

    // Validate service-menu snapshot server-side: only trust canonical name/price
    let snapshot = null;
    if (selectedServiceMenuItem?.id) {
      const menu = member.serviceMenu || [];
      const canonical = menu.find((it) => String(it.id) === String(selectedServiceMenuItem.id));
      if (!canonical) {
        throw new Error(contractErrors.SERVICE_MENU_ITEM_NOT_FOUND);
      }
      if (canonical.isActive === false) {
        throw new Error(contractErrors.SERVICE_MENU_ITEM_INACTIVE);
      }
      snapshot = { id: String(canonical.id), name: canonical.name, price: canonical.price };
    }

    const savedContract = await contractRepository.create({
      clientId,
      memberId,
      declaredMarketValue,
      boxIncluded,
      shoeDetails,
      repairDetails: {
        ...repairDetails,
        memberNotes: "",
      },
      proposedPrice: null,
      price: null,
      chatId: null,
      status: contractStatus.pendingReview,
      paymentStatus: null,
      selectedServiceMenuItem: snapshot,
      timeline: [
        {
          event: contractEvent.contractCreated,
          date: new Date(),
        },
      ],
    });

    await userRepository.pushContractToUser(clientId, savedContract._id, memberId);
    await memberRepository.pushContractToMember(memberId, savedContract._id, clientId);

    return savedContract;
  },

  /**
   * Single shared path for proposing a price (used by both the direct
   * createContractPrice mutation and any in-chat flow): builds the Stripe
   * product name, creates the payment intent, and updates the contract with
   * a PRICE_PROPOSED timeline event so every proposal is recorded.
   */
  async proposePrice(stripeConnectAccountId, contractId, price) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }

    const productName = buildShoeProductName(contract.shoeDetails);

    const { url } = await createPaymentIntent(
      stripeConnectAccountId,
      price,
      contractId.toString(),
      productName
    );

    const platformFeeCents = Math.round(price * platformFee.rate * 100);
    const payoutAmountCents = price * 100 - platformFeeCents;

    await contractRepository.updateById(contractId, {
      proposedPrice: price,
      platformFee: platformFeeCents / 100,
      payoutAmount: payoutAmountCents / 100,
      status: contractStatus.priceProposed,
      $push: { timeline: { event: contractEvent.priceProposedByMember, date: new Date() } },
    });

    return url;
  },

  /**
   * Merges allowed fields onto an existing contract. Nested objects are
   * merged per-key instead of replaced. Throws UNAUTHORIZED when the
   * requester is not the owning member.
   */
  async updateContract(requesterMemberId, id, data) {
    const contract = await contractRepository.findById(id);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (requesterMemberId && contract.memberId.toString() !== requesterMemberId) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }

    const nestedPaths = ["repairDetails", "shoeDetails", "inboundTracking", "outboundTracking"];
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) return;
      if (nestedPaths.includes(key) && typeof data[key] === "object" && !Array.isArray(data[key])) {
        Object.keys(data[key]).forEach((subKey) => {
          if (data[key][subKey] !== undefined) {
            contract[key][subKey] = data[key][subKey];
          }
        });
      } else {
        contract[key] = data[key];
      }
    });

    await contractRepository.save(contract);
    return true;
  },

  /**
   * Reuses the contract's existing chat or creates one, then records a
   * CHAT_INITIATED timeline event. Throws UNAUTHORIZED for non-owning members.
   */
  async initiateContractChat(memberId, contractId) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (!memberId || contract.memberId.toString() !== memberId.toString()) {
      throw new Error(contractErrors.UNAUTHORIZED);
    }

    if (contract.chatId) {
      const existingChat = await chatRepository.findChatById(contract.chatId);
      if (existingChat) {
        return existingChat;
      }
    }

    const name =
      `${contract.shoeDetails?.brand || ""} ${contract.shoeDetails?.model || ""}`.trim() ||
      "Contract Chat";

    const savedChat = await chatRepository.createChat({
      name,
      memberId,
      userId: contract.clientId,
      contractId: contract._id,
    });

    contract.chatId = savedChat._id;
    contract.timeline.push({ event: contractEvent.chatInitiated, date: new Date() });
    await contractRepository.save(contract);

    return savedChat;
  },

  /**
   * Releases a pending payout to the owning member via Stripe and marks the
   * contract paid with a PAYOUT_RELEASED timeline event.
   */
  async releasePayout(contractId) {
    const contract = await contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(contractErrors.CONTRACT_NOT_FOUND);
    }
    if (contract.payoutStatus !== payoutStatus.pending) {
      throw new Error(contractErrors.NO_PENDING_PAYOUT);
    }

    const member = await memberRepository.findById(contract.memberId);
    if (!member?.stripeConnectAccountId) {
      throw new Error(contractErrors.MEMBER_STRIPE_NOT_CONNECTED);
    }

    const amountCents = Math.round(contract.payoutAmount * 100);
    const transfer = await releasePayoutToMember(
      member.stripeConnectAccountId,
      amountCents,
      contractId
    );

    await contractRepository.updateById(contractId, {
      payoutStatus: payoutStatus.paid,
      stripeTransferId: transfer.id,
      paidAt: new Date(),
      status: contractStatus.completed,
      $push: { timeline: { event: contractEvent.payoutReleased, date: new Date() } },
    });

    return true;
  },

  async getContractMember(memberId) {
    return await memberRepository.findById(memberId);
  },

  async getContractClient(clientId) {
    return await userRepository.findById(clientId);
  },
};
