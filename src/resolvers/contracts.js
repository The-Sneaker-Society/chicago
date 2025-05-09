import MemberModel from "../models/Member.model";
import UserModel from "../models/User.model";
import ContractModel from "../models/Contract.model";
import { createPaymentIntent } from "../stripe/stripe.service";
import mongoose from "mongoose";

const Query = {
  async contracts() {
    try {
      const contracts = await ContractModel.find();
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
      // Validate that the context contains a valid member ID
      if (!ctx.dbUser) {
        throw new Error("Unauthorized: Member ID is missing in the context.");
      }

      const { id } = ctx.dbUser;

      const memberId = mongoose.Types.ObjectId.isValid(id)
        ? mongoose.Types.ObjectId(id)
        : id;

      // Aggregate contract counts by stage
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
        notStarted: 0,
        pendingReview: 0,
        started: 0,
        finished: 0,
      };

      // Map database stages to status counts
      const STAGE_MAP = {
        PENDING_REVIEW: "notStarted",
        STARTED: "started",
        FINISHED: "finished",
      };

      contractCounts.forEach((stage) => {
        const statusKey = STAGE_MAP[stage._id];
        if (statusKey) {
          statusCounts[statusKey] = stage.count;
        }
      });

      console.log("Status Counts:", statusCounts); // Debugging log

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
      const { memberId, shoeDetails, repairDetails } = args.data;
      const clientId = ctx.dbUser._id;

      const member = await MemberModel.findById(memberId);

      if (!member) {
        throw new Error("member not found");
      }

      const newContract = new ContractModel({
        clientId,
        memberId,
        shoeDetails,
        repairDetails: {
          ...repairDetails,
          memberNotes: "",
        },
        proposedPrice: null,
        price: null,
        chatId: null,
        status: "PENDING_REVIEW",
        trackingNumber: null,
        shippingCarrier: null,
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
        $push: { contracts: savedContract._id, members: memberId },
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

      const url = await createPaymentIntent(
        stripeConnectAccountId,
        price,
        contractId
      );
      return url;
    } catch (err) {
      throw new Error(err);
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
