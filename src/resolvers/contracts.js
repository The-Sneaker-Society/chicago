import { contractService } from "../contracts/contract.service.js";
import { contractErrors } from "../contracts/contract.constants.js";

const Query = {
  async contracts(parent, args, ctx, info) {
    try {
      return await contractService.getContractsForContext(ctx.dbUser, ctx.role);
    } catch (e) {
      throw new Error(e);
    }
  },
  async contractById(parent, args, ctx, info) {
    try {
      return await contractService.getContractById(args.id.toString());
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("contract not found");
      }
      throw new Error(e);
    }
  },
  async memberContractStatus(parent, args, ctx, info) {
    try {
      if (!ctx.dbUser) {
        throw new Error("Unauthorized: Member ID is missing in the context.");
      }

      const { id } = ctx.dbUser;
      return await contractService.getMemberContractStatus(id);
    } catch (e) {
      console.error("Error in memberContractStatus resolver:", e.message);
      throw new Error(
        "Failed to fetch member contract status. Please try again."
      );
    }
  },
  async getContractList(parent, args, ctx, info) {
    try {
      return await contractService.getContractList(ctx.dbUser.contracts);
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createContract(parent, args, ctx, info) {
    try {
      const clientId = ctx.dbUser._id;
      return await contractService.createContract(clientId, args.data);
    } catch (e) {
      if (e.message === contractErrors.MEMBER_NOT_FOUND) {
        throw new Error("member not found");
      }
      throw new Error(e);
    }
  },
  async createContractPrice(parent, args, ctx, info) {
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
  },
  async updateContract(parent, args, ctx, info) {
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
  },
  async initiateContractChat(parent, args, ctx, info) {
    try {
      const { contractId } = args;
      const memberId = ctx.dbUser?._id;

      if (!memberId) {
        throw new Error("Unauthorized");
      }

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
  },
  async releasePayout(parent, args, ctx, info) {
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
  },
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
