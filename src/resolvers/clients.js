import { UserInputError } from "apollo-server-core";
import { clientService } from "../clients/client.service.js";

const Query = {
  async clients(parent, args, ctx, info) {
    try {
      return await clientService.getClients();
    } catch (e) {
      throw new Error(e);
    }
  },
  async clientByEmail(parent, args, ctx, info) {
    try {
      return await clientService.getClientByEmail(args.email);
    } catch (e) {
      if (e.message === "CLIENT_NOT_FOUND") {
        throw new Error("Client Not Found");
      }
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createClient(parent, args, ctx, info) {
    try {
      return await clientService.createClient(args.data);
    } catch (e) {
      // Preserve Apollo error semantics for invalid member input.
      if (e.message === "MEMBER_NOT_FOUND") {
        throw new UserInputError("Member does not exist.");
      }
      throw e;
    }
  },
  async updateClient(parent, args, ctx, info) {
    try {
      const { id, ...updateData } = args.data;
      return await clientService.updateClient(id, updateData);
    } catch (e) {
      if (e.message === "CLIENT_NOT_FOUND") {
        throw new UserInputError("Client not found.");
      }
      throw e;
    }
  },
};

const Client = {
  async members(parent, args, ctx, info) {
    try {
      return await clientService.getMembersForClient(parent.id);
    } catch (e) {
      throw new Error(e);
    }
  },
  async contracts(parent, args, ctx, info) {
    try {
      return await clientService.getContractsForClient(parent.id);
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Mutation, Client };
