import { contractService } from "../contracts/contract.service.js";
import { contractErrors } from "../contracts/contract.constants.js";
import { requireAuth, requireMember } from "../auth/guards.js";

const Query = {
  contracts: requireAuth(async (parent, args, ctx, info) => {
    try {
      return await contractService.getContractsForContext(ctx.dbUser, ctx.role);
    } catch (e) {
      throw new Error(e);
    }
  }),
  contractById: requireAuth(async (parent, args, ctx, info) => {
    try {
      return await contractService.getContractById(
        args.id.toString(),
        ctx.dbUser?._id
      );
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("contract not found");
      }
      throw new Error(e);
    }
  }),
  memberContractStatus: requireAuth(async (parent, args, ctx, info) => {
    try {
      const { id } = ctx.dbUser;
      return await contractService.getMemberContractStatus(id);
    } catch (e) {
      console.error("Error in memberContractStatus resolver:", e.message);
      throw new Error(
        "Failed to fetch member contract status. Please try again."
      );
    }
  }),
  getContractList: requireAuth(async (parent, args, ctx, info) => {
    try {
      return await contractService.getContractList(ctx.dbUser.contracts);
    } catch (e) {
      throw new Error(e);
    }
  }),
};

const Mutation = {
  createContract: requireMember(async (parent, args, ctx, info) => {
    try {
      const clientId = ctx.dbUser._id;
      return await contractService.createContract(clientId, args.data);
    } catch (e) {
      if (e.message === contractErrors.MEMBER_NOT_FOUND) {
        throw new Error("member not found");
      }
      throw new Error(e);
    }
  }),
  createContractPrice: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId, price } = args.data;
      const { stripeConnectAccountId } = ctx.dbUser;

      return await contractService.proposePrice(
        stripeConnectAccountId,
        contractId,
        price
      );
    } catch (e) {
      throw new Error(e);
    }
  }),
  updateContract: requireMember(async (parent, args, ctx, info) => {
    try {
      const { id, data } = args;
      const memberId = ctx.dbUser?._id?.toString();
      return await contractService.updateContract(memberId, id, data);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this member"
        );
      }
      throw new Error(e);
    }
  }),
  initiateContractChat: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId } = args;
      const memberId = ctx.dbUser._id;

      return await contractService.initiateContractChat(memberId, contractId);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this member"
        );
      }
      throw new Error(e);
    }
  }),
  releasePayout: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId } = args;
      return await contractService.releasePayout(contractId);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.NO_PENDING_PAYOUT) {
        throw new Error("No pending payout for this contract");
      }
      if (e.message === contractErrors.MEMBER_STRIPE_NOT_CONNECTED) {
        throw new Error("Member is not connected to Stripe");
      }
      throw new Error(e);
    }
  }),
};

const Contract = {
  async member(parent, args, ctx, info) {
    try {
      return await contractService.getContractMember(parent.memberId);
    } catch (e) {
      throw new Error(e);
    }
  },
  async client(parent, args, ctx, info) {
    try {
      return await contractService.getContractClient(parent.clientId);
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Contract, Mutation };
