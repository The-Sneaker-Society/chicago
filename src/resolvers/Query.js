import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import ContractModel from "../models/Contract.model";
import UserModel from "../models/User.model";

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
  async users(parent, args, ctx, info) {
    try {
      console.log(ctx)
      const users = await UserModel.find();
      return users;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export { Query as default };
