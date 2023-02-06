import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import ContractModel from "../models/Contract.model";
import EmailModel from "../models/Email.model";
import { GraphQLError } from "graphql";

const Mutation = {
  createEmail: async (parent, args, ctx, info) => {
    try {
      const { email } = args.data;
      if (email) {
        const newEmailAddition = new EmailModel({
          email: email,
        });

        const res = await newEmailAddition.save();

        return { ...res._doc, id: res._id };
      }
    } catch (e) {
      if (e.code === 11000) {
        throw new GraphQLError("Email already in use");
      }

      throw new GraphQLError("unable to register email");
    }
  },
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
          members: memberId,
        });

        const res = await client.save();

        // add Client to member
        member.clients.push(res._id);

        // Update member
        await member.save();
        // return member.populate("clients");
        return { ...res._doc, id: res._id };
      } else {
        throw new UserInputError("member does not exist.");
      }
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Client = {
  async members(parent, args, ctx, ifo) {
    try {
      const members = await MemberModel.find();

      return members.filter((member) => {
        return member.clients.includes(parent.id);
      });
    } catch (e) {
      throw new Error(e);
    }
  },
  async contracts(parent, args, ctx, info) {
    try {
      const contracts = await ContractModel.find();
      return contracts.filter(
        (contract) => contract.client.toString() === parent.id
      );
      // return contracts;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Mutation, Client };
