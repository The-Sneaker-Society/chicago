import { UserInputError } from "apollo-server-core";
import { contractService } from "../contracts/contract.service.js";
import { contractErrors } from "../contracts/contract.constants.js";
import { requireAuth, requireClient, requireMember } from "../auth/guards.js";

import pubsub from "../pubsub";

const publish = (trigger, payload) => pubsub.publish(trigger, payload);

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
  contractByOrderRef: requireAuth(async (parent, args, ctx, info) => {
    try {
      return await contractService.getContractByOrderRef(
        args.orderRef,
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
      // Unprovisioned/admin contexts have dbUser: null — fail with a clear
      // error instead of TypeError on destructure.
      if (!ctx.dbUser) {
        throw new Error("Account provisioning incomplete.");
      }
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
      // Unprovisioned/admin contexts have dbUser: null — empty list, never crash.
      return await contractService.getContractList(ctx.dbUser?.contracts ?? []);
    } catch (e) {
      throw new Error(e);
    }
  }),
  shippingRateOptions: requireAuth(async (parent, args, ctx, info) => {
    try {
      const { orderRef, preset, withInsurance, withSignature } = args;
      return await contractService.quoteShipping(ctx.dbUser?._id, orderRef, {
        preset,
        withInsurance,
        withSignature,
      });
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (
        e.message === contractErrors.INVALID_SHIPPING_PRESET ||
        e.message === contractErrors.MISSING_SHIPPING_ADDRESS
      ) {
        throw new UserInputError(e.message);
      }
      throw new Error(e);
    }
  }),
};

const Mutation = {
  createContract: requireAuth(async (parent, args, ctx, info) => {
    try {
      // Client-side intake (user/new-contract/:memberId): the clientId is
      // always the requester — never taken from input. Members cannot
      // create contracts through this path.
      return await contractService.createContract(
        { dbId: ctx.dbUser?._id, role: ctx.role },
        args.data
      );
    } catch (e) {
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error("Only clients can create contracts");
      }
      if (e.message === contractErrors.INVALID_MEMBER_ID) {
        throw new UserInputError("Invalid member ID");
      }
      if (e.message === contractErrors.MEMBER_NOT_FOUND) {
        throw new Error("member not found");
      }
      if (e.message === contractErrors.SERVICE_MENU_ITEM_NOT_FOUND) {
        throw new UserInputError("Service menu item not found");
      }
      if (e.message === contractErrors.SERVICE_MENU_ITEM_INACTIVE) {
        throw new UserInputError("Service menu item is inactive");
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
  updateShipping: requireAuth(async (parent, args, ctx, info) => {
    try {
      const { id, data } = args;
      return await contractService.updateShipping(ctx.dbUser?._id, id, data);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.INVALID_SHIPPING_PRESET) {
        throw new UserInputError("Invalid shipping preset");
      }
      if (e.message === contractErrors.INVALID_SHIPPING_SPEED) {
        throw new UserInputError("Invalid shipping speed");
      }
      throw new Error(e);
    }
  }),
  createContractCheckout: requireClient(async (parent, args, ctx, info) => {
    try {
      const { contractId, shippingPreset, shippingSpeed, insuranceDeclined, signatureRequired, inboundRateId, outboundRateId } = args.data;
      return await contractService.createContractCheckout(
        ctx.dbUser?._id,
        contractId,
        { shippingPreset, shippingSpeed, insuranceDeclined, signatureRequired, inboundRateId, outboundRateId },
        publish
      );
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.CHECKOUT_NOT_ALLOWED) {
        throw new UserInputError("Contract is not ready for checkout");
      }
      if (e.message === contractErrors.MEMBER_STRIPE_NOT_CONNECTED) {
        throw new Error("Member is not connected to Stripe");
      }
      if (
        e.message === contractErrors.INVALID_SHIPPING_PRESET ||
        e.message === contractErrors.INVALID_SHIPPING_SPEED
      ) {
        throw new UserInputError("Invalid shipping selection");
      }
      if (e.message === contractErrors.INVALID_SHIPPING_RATE) {
        throw new UserInputError(
          "Shipping options expired — please choose a shipping option again"
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
  cancelContract: requireAuth(async (parent, args, ctx, info) => {
    try {
      const { contractId, reason } = args;
      return await contractService.cancelContract(contractId, reason, ctx, publish);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new UserInputError("Contract not found");
      }
      if (e.message === contractErrors.ALREADY_CANCELED) {
        throw new UserInputError("Contract is already canceled or completed");
      }
      if (e.message === contractErrors.CANCEL_NOT_ALLOWED) {
        throw new UserInputError("Contract cannot be canceled at this stage");
      }
      if (e.message === contractErrors.INVALID_TRANSITION) {
        throw new UserInputError(e.message);
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error("Unauthorized");
      }
      throw new Error(e.message || e);
    }
  }),
  startWork: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId } = args;
      return await contractService.startWork(contractId, ctx.dbUser?._id);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this member"
        );
      }
      if (
        e.message === contractErrors.UNBOXING_PHOTOS_REQUIRED ||
        e.message === contractErrors.BAD_TRANSITION
      ) {
        throw new UserInputError(e.message);
      }
      throw new Error(e);
    }
  }),
  markWorkComplete: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId } = args;
      return await contractService.markWorkComplete(contractId, ctx.dbUser?._id);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this member"
        );
      }
      if (e.message === contractErrors.BAD_TRANSITION) {
        throw new UserInputError(e.message);
      }
      throw new Error(e);
    }
  }),
  markReturnShipped: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId } = args;
      return await contractService.markReturnShipped(contractId, ctx.dbUser?._id);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this member"
        );
      }
      if (e.message === contractErrors.BAD_TRANSITION) {
        throw new UserInputError(e.message);
      }
      throw new Error(e);
    }
  }),
  uploadReturnPackagingPhotos: requireMember(async (parent, args, ctx, info) => {
    try {
      const { contractId, keys } = args;
      return await contractService.uploadReturnPackagingPhotos(
        contractId,
        ctx.dbUser?._id,
        keys || []
      );    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this member"
        );
      }
      if (e.message === contractErrors.BAD_TRANSITION) {
        throw new UserInputError(e.message);
      }
      throw new Error(e);
    }
  }),
  uploadPackagingPhotos: requireClient(async (parent, args, ctx, info) => {
    try {
      const { contractId, keys } = args;
      return await contractService.uploadPackagingPhotos(
        contractId,
        ctx.dbUser?._id,
        keys || []
      );
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this client"
        );
      }
      if (e.message === contractErrors.BAD_TRANSITION) {
        throw new UserInputError(e.message);
      }
      throw new Error(e);
    }
  }),
  flagContract: requireAuth(async (parent, args, ctx, info) => {
    try {
      const { contractId, reason } = args;
      // Freezing a payout demands an accountability trail — blank reasons
      // are rejected here (resolvers validate input per AGENTS.md).
      if (!reason || !reason.trim()) {
        throw new UserInputError("A reason is required to flag a contract");
      }
      return await contractService.flagContract(
        contractId,
        ctx.dbUser?._id,
        reason.trim()
      );
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new UserInputError("Contract not found");
      }
      if (e.message === contractErrors.BAD_TRANSITION) {
        throw new UserInputError("Contract cannot be flagged at this stage");
      }
      throw new Error(e.message || e);
    }
  }),
  confirmReceipt: requireClient(async (parent, args, ctx, info) => {
    try {
      const { contractId } = args;
      return await contractService.confirmReceipt(contractId, ctx.dbUser?._id);
    } catch (e) {
      if (e.message === contractErrors.CONTRACT_NOT_FOUND) {
        throw new Error("Contract not found");
      }
      if (e.message === contractErrors.UNAUTHORIZED) {
        throw new Error(
          "Unauthorized: Contract does not belong to this client"
        );
      }
      if (e.message === contractErrors.BAD_TRANSITION) {
        throw new UserInputError("Contract is not ready for acceptance");
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
