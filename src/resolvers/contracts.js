import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import ContractModel from "../models/Contract.model";

const Mutation = {
  async createContract(parent, args, ctx, info) {
    try {
      const { memberId, eta, client, stage, price, notes, photos, reported } =
        args.data;

      // Find member
      const foundMember = await MemberModel.findById(memberId);

      // // Find Client
      const foundClient = await ClientModel.findById(client);

      // create Contract Instance
      const newContract = new ContractModel({
        client: foundClient,
        member: foundMember,
        eta,
        stage,
        price,
        notes,
        reported: false,
        photos: photos,
      });


      // Create contract
      const res = await newContract.save();

      // Add contract to Member and Client
      foundMember.contracts.push(res._id)
      foundClient.contracts.push(res._id)
      await foundClient.save()
      await foundMember.save()

      // Return contract
      return { ...res._doc, id: res._id };
    } catch (e) {
      throw new Error(e);
    }
  },
};

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

export default { Contract, Mutation };
