import MemberModel from "../models/Member.model";
import ClientModel from "../models/Client.model";
import ContractModel from "../models/Contract.model";
import { sendEmail } from "../utils/sendEmail";

const Query = {
  async contracts() {
    try {
      const contracts = await ContractModel.find();
      return contracts;
    } catch (e) {
      throw new Error(e);
    }
  },
  async contractById(parent, args, ctx, info) {
    try {
      const contract = await ContractModel.findById(args.id.toString());

      if (!contract) {
        throw new Error("contract not found");
      }

      return contract;
    } catch (e) {
      throw new Error(e);
    }
  },
  async memberContractStatus(parent, args, ctx, info) {
    try {
      const contractCounts = await ContractModel.aggregate([
        {
          $match: { member: ctx._id },
        },
        {
          $group: {
            _id: "$stage",
            count: { $sum: 1 },
          },
        },
      ]);

      const statusCounts = {
        notStarted: 0,
        started: 0,
        finished: 0,
      };

      contractCounts.forEach((stage) => {
        if (stage._id === "NOT_STARTED") statusCounts.notStarted = stage.count;
        if (stage._id === "STARTED") statusCounts.started = stage.count;
        if (stage._id === "FINISHED") statusCounts.finished = stage.count;
      });

      return statusCounts;
    } catch (e) {
      throw new Error(e);
    }
  },
};
const Mutation = {
  async createContract(parent, args, ctx, info) {
    try {
      const { memberId, eta, client, stage, price, notes, photos, reported } =
        args.data;

      const foundMember = await MemberModel.findById(memberId);

      const foundClient = await ClientModel.findById(client);

      const newContract = new ContractModel({
        client: foundClient,
        member: foundMember,
        eta,
        stage: "NOT_STARTED",
        price,
        notes,
        reported: false,
        photos: photos,
      });

      const res = await newContract.save();

      const isAlreadyClient =
        foundClient.members.filter((member) => {
          return member.toString() === memberId;
        }).length > 0;

      if (!isAlreadyClient) {
        foundClient.members.push(memberId);
        foundMember.clients.push(foundClient.id.toString());
      }

      foundMember.contracts.push(res._id);
      foundClient.contracts.push(res._id);
      await foundClient.save();
      await foundMember.save();

      const { firstName, lastName, email } = foundMember;

      await sendEmail(
        "New Contract!",
        email,
        {
          userName: `${firstName} ${lastName}`,
          link: `${process.env.APP_URL}/dashboard`,
        },
        "src/emails/new_contract.html"
      );

      await sendEmail(
        "Thank You",
        foundClient.email,
        {
          userName: `${foundClient.firstName}`,
          memberName: `${firstName}`,
        },
        "src/emails/new_contract_client.html"
      );

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

export default { Query, Contract, Mutation };
