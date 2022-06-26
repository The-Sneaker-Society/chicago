import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import ContractModel from "../models/Contract.model";

const Query = {
  hello: () => {
    return "Hello world";
  },
  async members() {
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
      return member;
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
