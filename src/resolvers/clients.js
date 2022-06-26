import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";

const Mutation = {
  creatClient: async (parent, args, ctx, info) => {
    try {
      const { email, firstName, lastName, memberId } = args.data;

      // Finde if member exists
      const member = await MemberModel.findById(memberId);

      // if member exists
      if (member) {
        // Create client
        const client = new ClientModel({
          email,
          firstName,
          lastName,
          memberId,
        });

        await client.save();

        // add Client to member
        member.clients.push(memberId);

        // Update member
        await member.save();
        return member.populate("clients");
      } else {
        throw new UserInputError("member does not exist.");
      }
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Client = {
  async member(parent, args, ctx, ifo) {
    try {
      const member = await MemberModel.findById(parent.memberId);

      if (!member) {
        throw new Error("Member not found");
      }

      return member;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Mutation, Client };
