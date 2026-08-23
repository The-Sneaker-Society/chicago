import { createPaymentIntent, releasePayoutToMember } from "../stripe/stripe.service";
import { contractRepository } from "./contract.repository.js";

const STAGE_MAP = {
  PENDING_REVIEW: "pendingReview",
  PRICE_PROPOSED: "priceProposed",
  PRICE_ACCEPTED: "priceAccepted",
  WAITING_SHIPMENT: "waitingShipment",
  SHIPPED: "shipped",
  ARRIVED_AT_MEMBER: "arrivedAtMember",
  WORK_IN_PROGRESS: "workInProgress",
  PROCESSING_RETURN: "processingReturn",
  SHIPPED_BACK: "shippedBack",
  USER_RECEIVED: "userReceived",
  PAYOUT_RELEASED: "payoutReleased",
};

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

  async getContractById(id) {
    const contract = await contractRepository.findById(id);
    if (!contract) {
      throw new Error("CONTRACT_NOT_FOUND");
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

    const statusCounts = {
      pendingReview: 0,
      priceProposed: 0,
      priceAccepted: 0,
      waitingShipment: 0,
      shipped: 0,
      arrivedAtMember: 0,
      workInProgress: 0,
      processingReturn: 0,
      shippedBack: 0,
      userReceived: 0,
      payoutReleased: 0,
    };

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
    const { memberId, shoeDetails, repairDetails, declaredMarketValue, boxIncluded } = input;

    const member = await contractRepository.findMemberById(memberId);
    if (!member) {
      throw new Error("MEMBER_NOT_FOUND");
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
      status: "PENDING_REVIEW",
      paymentStatus: null,
      timeline: [
        {
          event: "CONTRACT_CREATED",
          date: new Date(),
        },
      ],
    });

    await contractRepository.pushContractToUser(clientId, savedContract._id, memberId);
    await contractRepository.pushContractToMember(memberId, savedContract._id, clientId);

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
      throw new Error("CONTRACT_NOT_FOUND");
    }

    const productName = buildShoeProductName(contract.shoeDetails);

    const { url } = await createPaymentIntent(
      stripeConnectAccountId,
      price,
      contractId.toString(),
      productName
    );

    await contractRepository.updateById(contractId, {
      proposedPrice: price,
      status: "PRICE_PROPOSED",
      $push: { timeline: { event: "PRICE_PROPOSED", date: new Date() } },
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
      throw new Error("CONTRACT_NOT_FOUND");
    }
    if (requesterMemberId && contract.memberId.toString() !== requesterMemberId) {
      throw new Error("UNAUTHORIZED");
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
      throw new Error("CONTRACT_NOT_FOUND");
    }
    if (!memberId || contract.memberId.toString() !== memberId.toString()) {
      throw new Error("UNAUTHORIZED");
    }

    if (contract.chatId) {
      const existingChat = await contractRepository.findChatById(contract.chatId);
      if (existingChat) {
        return existingChat;
      }
    }

    const name =
      `${contract.shoeDetails?.brand || ""} ${contract.shoeDetails?.model || ""}`.trim() ||
      "Contract Chat";

    const savedChat = await contractRepository.createChat({
      name,
      memberId,
      userId: contract.clientId,
      contractId: contract._id,
    });

    contract.chatId = savedChat._id;
    contract.timeline.push({ event: "CHAT_INITIATED", date: new Date() });
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
      throw new Error("CONTRACT_NOT_FOUND");
    }
    if (contract.payoutStatus !== "pending") {
      throw new Error("NO_PENDING_PAYOUT");
    }

    const member = await contractRepository.findMemberById(contract.memberId);
    if (!member?.stripeConnectAccountId) {
      throw new Error("MEMBER_STRIPE_NOT_CONNECTED");
    }

    const amountCents = Math.round(contract.payoutAmount * 100);
    const transfer = await releasePayoutToMember(
      member.stripeConnectAccountId,
      amountCents,
      contractId
    );

    await contractRepository.updateById(contractId, {
      payoutStatus: "paid",
      stripeTransferId: transfer.id,
      paidAt: new Date(),
      status: "PAYOUT_RELEASED",
      $push: { timeline: { event: "PAYOUT_RELEASED", date: new Date() } },
    });

    return true;
  },

  async getContractMember(memberId) {
    return await contractRepository.findMemberById(memberId);
  },

  async getContractClient(clientId) {
    return await contractRepository.findUserById(clientId);
  },
};
