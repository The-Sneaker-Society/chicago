import { UserInputError } from "apollo-server-core";
import Member from "../../models/Member.model";
import ClientModel from "../../models/Client.model";

const Query = {
  hello: () => {
    return "Hello world";
  },
  async members() {
    try {
      const members = await Member.find().populate("clients");

      console.log(members);
      return members;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createMember(parent, args, ctx, info) {
    const { email, firstName, lastName } = args.data;

    const member = Member.findOne({ email: email });

    // if (member) {
    //   throw new UserInputError("Email is taken.", {
    //     errors: {
    //       email: "This email is taken.",
    //     },
    //   });
    // }

    const newMember = new Member({
      email,
      firstName,
      lastName,
    });

    const res = await newMember.save();

    return { ...res._doc, id: res._id };
  },
};

export default { Query, Mutation };
