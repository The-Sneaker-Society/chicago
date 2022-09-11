import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import ContractModel from "../models/Contract.model";
import mongoose from "mongoose";

const Query = {
  hello: () => {
    return "Hello world";
  },
  async members(parent, args, { id }, info) {
    try {
      const members = await MemberModel.find();
      return members;
    } catch (e) {
      throw new Error(e);
    }
  },
  async memberById(parent, args, ctx, info) {
    try {
      // console.log(args.id);
      const member = await MemberModel.findById(args.id.toString());

      // console.log(member.createdAt)
      if (!member) {
        throw new Error("Member not found");
      }

      return member;
    } catch (e) {
      throw new Error(e);
    }
  },
  async memberStatsById(parent, args, ctx, info) {
    try {
      // Find Member
      const member = await MemberModel.findById(args.id.toString());

      // Find Contracts of member.
      const contracts = await ContractModel.find({
        _id: { $in: member.contracts },
      });

      console.log(contracts);

      // Do stat calcs
      const notStarted = contracts.filter(
        (contract) => contract.stage === "NOT_STARTED"
      );

      const started = contracts.filter(
        (contract) => contract.stage === "STARTED"
      );

      const finished = contracts.filter(
        (contract) => contract.stage === "FINISHED"
      );

      // // console.log(member.createdAt)
      // if (!member) {
      //   throw new Error("Member not found");
      // }

      // return member;
      const stats = {
        id: args.id.toString(),
        notStarted: notStarted.length,
        started: started.length,
        finished: finished.length,
      };
      return stats;
    } catch (e) {
      throw new Error(e);
    }
  },

  async clients() {
    try {
      const clients = await ClientModel.find();
      return clients;
    } catch (e) {
      throw new Error(e);
    }
  },
  async clientByEmail(parent, args, ctx, info) {
    try {
      const client = await ClientModel.findOne({ email: args.email });
      if (!client) {
        throw new Error("Client Not Found");
      }

      return client;
    } catch (e) {
      throw new Error(e);
    }
  },
  async contracts() {
    try {
      const contracts = await ContractModel.find();
      return contracts;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export { Query as default };
