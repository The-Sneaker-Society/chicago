import { UserInputError } from "apollo-server-core";
import { clientService } from "../clients/client.service.js";
import { requireAdmin, requireAuth, requireClient } from "../auth/guards.js";

const Query = {
  // Directory dump — admin-only (plan.md Wave 3)
  clients: requireAdmin(async (parent, args, ctx, info) => {
    try {
      return await clientService.getClients();
    } catch (e) {
      throw new Error(e);
    }
  }),
  clientByEmail: requireAuth(async (parent, args, ctx, info) => {
    try {
      return await clientService.getClientByEmail(args.email);
    } catch (e) {
      if (e.message === "CLIENT_NOT_FOUND") {
        throw new Error("Client Not Found");
      }
      throw new Error(e);
    }
  }),
};

const Mutation = {
  createClient: requireClient(async (parent, args, ctx, info) => {
    try {
      return await clientService.createClient(args.data);
    } catch (e) {
      // Preserve Apollo error semantics for invalid member input.
      if (e.message === "MEMBER_NOT_FOUND") {
        throw new UserInputError("Member does not exist.");
      }
      throw e;
    }
  }),
  updateClient: requireClient(async (parent, args, ctx, info) => {
    try {
      const { id, ...updateData } = args.data;
      return await clientService.updateClient(id, updateData);
    } catch (e) {
      if (e.message === "CLIENT_NOT_FOUND") {
        throw new UserInputError("Client not found.");
      }
      throw e;
    }
  }),
};

const Client = {
  // Field reads are scoped to the requester's own db id, or parent id for admins.
  async members(parent, args, ctx, info) {
    try {
      const targetId = ctx?.role === "admin" ? (parent.id || parent._id) : ctx?.dbUser?._id;
      if (!targetId) return [];
      return await clientService.getMembersForClient(targetId);
    } catch (e) {
      throw new Error(e);
    }
  },
  async contracts(parent, args, ctx, info) {
    try {
      const targetId = ctx?.role === "admin" ? (parent.id || parent._id) : ctx?.dbUser?._id;
      if (!targetId) return [];
      return await clientService.getContractsForClient(targetId);
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Mutation, Client };
