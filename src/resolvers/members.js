import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import contracts from "./contracts";
import ContractModel from "../models/Contract.model";

const Mutation = {
  async createMember(parent, args, ctx, info) {
    const { email, firstName, lastName } = args.data;
    const member = await MemberModel.findOne({ email: email });
    if (member) {
      throw new UserInputError("Email is taken.", {
        errors: {
          email: "This email is taken.",
        },
      });
    }

    const newMember = new MemberModel({
      email,
      firstName,
      lastName,
      isActive: true,
    });

    const res = await newMember.save();

    return { ...res._doc, id: res._id };
  },
};

const Member = {
  async clients(parent, args, ctx, info) {
    try {
      const clients = await ClientModel.find();

      return clients.filter((client) => client.members.includes(parent.id));
    } catch (e) {
      throw new Error(e);
    }
  },

  async contracts(parent, args, ctx, info) {
    try {
      const contracts = await ContractModel.find();
      return contracts.filter(
        (contract) => contract.member.toString() === parent.id
      );
    } catch (e) {
      throw new Error(e);
    }
  },
};
export default { Mutation, Member };
