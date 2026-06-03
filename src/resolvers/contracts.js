import MemberModel from "../models/Member.model";
import UserModel from "../models/User.model";
import ContractModel from "../models/Contract.model";
import ChatModel from "../models/Chat.model";
import { createPaymentIntent, releasePayoutToMember } from "../stripe/stripe.service";
import mongoose from "mongoose";

const Query = {
  async contracts(parent, args, ctx, info) {
    try {
      if (!ctx.dbUser) {
        return [];
      }

      const filter = {};
      if (ctx.role === "member") {
        filter.memberId = ctx.dbUser._id;
      } else if (ctx.role === "client") {
        filter.clientId = ctx.dbUser._id;
      }

      const contracts = await ContractModel.find(filter);
      return contracts;
    } catch (e) {
      throw new Error(e);
    }
  },
  async contractById(parent, args, ctx, info) {
    try {
      const contract = await ContractModel.findById(args.id.toString());

      if (!contract) {
        throw new Error("contract not found");
      }

      return contract;
    } catch (e) {
      throw new Error(e);
    }
  },
  async memberContractStatus(parent, args, ctx, info) {
    try {
      if (!ctx.dbUser) {
        throw new Error("Unauthorized: Member ID is missing in the context.");
      }

      const { id } = ctx.dbUser;

      const memberId = mongoose.Types.ObjectId.isValid(id)
        ? mongoose.Types.ObjectId(id)
        : id;

      const contractCounts = await ContractModel.aggregate([
        {
          $match: { memberId: memberId },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

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

      contractCounts.forEach((stage) => {
        const statusKey = STAGE_MAP[stage._id];
        if (statusKey) {
          statusCounts[statusKey] = stage.count;
        }
      });

      return statusCounts;
    } catch (e) {
      console.error("Error in memberContractStatus resolver:", e.message);
      throw new Error(
        "Failed to fetch member contract status. Please try again."
      );
    }
  },
  async getContractList(parent, args, ctx, info) {
    try {
      const contractIds = ctx.dbUser.contracts;

      const contracts = await ContractModel.find({ _id: { $in: contractIds } });

      return contracts.map((contract) => ({
        id: contract._id,
        name: `${contract.shoeDetails.brand} ${contract.shoeDetails.model}`,
        status: contract.status,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
      }));
    } catch (e) {
      throw new Error(e);
    }
  },
};
const Mutation = {
  async createContract(parent, args, ctx, info) {
    try {
      const { memberId, shoeDetails, repairDetails, declaredMarketValue, boxIncluded } = args.data;
      const clientId = ctx.dbUser._id;

      const member = await MemberModel.findById(memberId);

      if (!member) {
        throw new Error("member not found");
      }

      const newContract = new ContractModel({
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
            date: Date.now(),
          },
        ],
      });

      const savedContract = await newContract.save();

      await UserModel.findByIdAndUpdate(clientId, {
        $push: { contracts: savedContract._id },
        $addToSet: { members: memberId },
      });

      await MemberModel.findByIdAndUpdate(memberId, {
        $push: { contracts: savedContract._id, clients: clientId },
      });

      return savedContract;
    } catch (e) {
      throw new Error(e);
    }
  },
  async createContractPrice(parent, args, ctx, info) {
    try {
      const { contractId, price } = args.data;
      const { stripeConnectAccountId } = ctx.dbUser;

      const contract = await ContractModel.findById(contractId);
      const brand = contract?.shoeDetails?.brand || "";
      const model = contract?.shoeDetails?.model || "";
      const shoeLabel = [brand, model].filter(Boolean).join(" ") || "Sneaker";
      const productName = `Sneaker Society - ${shoeLabel}`;

      const url = await createPaymentIntent(
        stripeConnectAccountId,
        price,
        contractId,
        productName
      );

      await ContractModel.findByIdAndUpdate(contractId, {
        proposedPrice: price,
        status: "PRICE_PROPOSED",
      });

      return url;
    } catch (err) {
      throw new Error(err);
    }
  },
  async updateContract(parent, args, ctx, info) {
    try {
      const { id, data } = args;
      const contract = await ContractModel.findById(id);
      if (!contract) {
        throw new Error("Contract not found");
      }
      const memberId = ctx.dbUser?._id?.toString();
      if (memberId && contract.memberId.toString() !== memberId) {
        throw new Error("Unauthorized: Contract does not belong to this member");
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
      await contract.save();
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },
  async initiateContractChat(parent, args, ctx, info) {
    try {
      const { contractId } = args;
      const memberId = ctx.dbUser?._id;

      if (!memberId) {
        throw new Error("Unauthorized");
      }

      const contract = await ContractModel.findById(contractId);
      if (!contract) {
        throw new Error("Contract not found");
      }
      if (contract.memberId.toString() !== memberId.toString()) {
        throw new Error("Unauthorized: Contract does not belong to this member");
      }

      if (contract.chatId) {
        const existingChat = await ChatModel.findById(contract.chatId);
        if (existingChat) {
          return existingChat;
        }
      }

      const clientName = `${contract.shoeDetails?.brand || ""} ${contract.shoeDetails?.model || ""}`.trim() || "Contract Chat";

      const newChat = new ChatModel({
        name: clientName,
        memberId: memberId,
        userId: contract.clientId,
        contractId: contract._id,
      });

      const savedChat = await newChat.save();

      contract.chatId = savedChat._id;
      contract.timeline.push({ event: "CHAT_INITIATED", date: new Date() });
      await contract.save();

      return savedChat;
    } catch (e) {
      throw new Error(e);
    }
  },
  async releasePayout(parent, args, ctx, info) {
    try {
      const { contractId } = args;

      const contract = await ContractModel.findById(contractId);
      if (!contract) throw new Error("Contract not found");
      if (contract.payoutStatus !== "pending") {
        throw new Error("No pending payout for this contract");
      }

      const member = await MemberModel.findById(contract.memberId);
      if (!member?.stripeConnectAccountId) {
        throw new Error("Member is not connected to Stripe");
      }

      const amountCents = Math.round(contract.payoutAmount * 100);
      const transfer = await releasePayoutToMember(
        member.stripeConnectAccountId,
        amountCents,
        contractId
      );

      await ContractModel.findByIdAndUpdate(contractId, {
        payoutStatus: "paid",
        stripeTransferId: transfer.id,
        paidAt: new Date(),
        status: "PAYOUT_RELEASED",
        $push: { timeline: { event: "PAYOUT_RELEASED", date: new Date() } },
      });

      return true;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Contract = {
  async member(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(parent.memberId);
      return member;
    } catch (e) {
      throw new Error(e);
    }
  },
  async client(parent, args, ctx, info) {
    try {
      const client = await UserModel.findById(parent.clientId);
      return client;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Contract, Mutation };
