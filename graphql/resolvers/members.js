import { UserInputError } from "apollo-server-core";
import MemberModel from "../../models/Member.model";
import ClientModel from "../../models/Client.model";

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
};

const Mutation = {
  async createMember(parent, args, ctx, info) {
    const { email, firstName, lastName } = args.data;

    const member = MemberModel.findOne({ email: email });

    // if (member) {
    //   throw new UserInputError("Email is taken.", {
    //     errors: {
    //       email: "This email is taken.",
    //     },
    //   });
    // }

    const newMember = new MemberModel({
      email,
      firstName,
      lastName,
    });

    const res = await newMember.save();

    return { ...res._doc, id: res._id };
  },
};

const Member = {
  async clients(parent, args, ctx, info) {
    try {
      const clients = await ClientModel.find();

      return clients.filter(
        (client) => client.memberId.toString() === parent.id
      );
    } catch (e) {
      throw new Error(e);
    }
  },
};
export default { Query, Mutation, Member };
