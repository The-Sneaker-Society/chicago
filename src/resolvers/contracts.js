import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import ContractModel from "../models/Contract.model";
import { sendEmail } from "../utils/sendEmail";

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

      const isAlreadyClient =
        foundClient.members.filter((member) => {
          console.log(member);
          return member.toString() === memberId;
        }).length > 0;

      if (!isAlreadyClient) {
        foundClient.members.push(memberId);
        foundMember.clients.push(foundClient.id.toString());
      }

      // Add contract to Member and Client
      foundMember.contracts.push(res._id);
      foundClient.contracts.push(res._id);
      await foundClient.save();
      await foundMember.save();

      // Send Emails
      const { firstName, lastName, email } = foundMember;

      // Send email to Member
      await sendEmail(
        "New Contract!",
        email,
        {
          userName: `${firstName} ${lastName}`,
          link: `${process.env.APP_URL}/dashboard`,
        },
        "src/emails/new_contract.html"
      );

      // send email to Client
      await sendEmail(
        "Thank You",
        foundClient.email,
        {
          userName: `${foundClient.firstName}`,
          memberName: `${firstName}`,
        },
        "src/emails/new_contract_client.html"
      );

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
