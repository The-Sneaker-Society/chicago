import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";

const Mutation = {};

const Contract = {
  async member(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(parent.member.toString());
      return member;
    } catch (e) {
      throw new Error(e);
    }
  },
  async client(parent, args, ctx, info) {
    try {
      const client = await ClientModel.findById(parent.client.toString());
      return client;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Contract };
