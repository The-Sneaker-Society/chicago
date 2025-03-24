import MemberModel from "../models/Member.model";
import UserModel from "../models/User.model";
import ContractModel from "../models/Contract.model";
import { createPaymentIntent } from "../stripe/stripeUtils";

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
      const contractCounts = await ContractModel.aggregate([
        {
          $match: { member: ctx._id },
        },
        {
          $group: {
            _id: "$stage",
            count: { $sum: 1 },
          },
        },
      ]);

      const statusCounts = {
        notStarted: 0,
        started: 0,
        finished: 0,
      };

      contractCounts.forEach((stage) => {
        if (stage._id === "NOT_STARTED") statusCounts.notStarted = stage.count;
        if (stage._id === "STARTED") statusCounts.started = stage.count;
        if (stage._id === "FINISHED") statusCounts.finished = stage.count;
      });

      return statusCounts;
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
      console.log({ args, user: ctx.dbUser });
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
