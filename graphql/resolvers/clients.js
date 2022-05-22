import { UserInputError } from "apollo-server-core";
import Member from "../../models/Member.model";
import Client from "../../models/Client.model";


const Mutation = {
  creatClient: async (parent, args, ctx, info) => {
    try {
      const { email, firstName, lastName, memberId } = args.data;

      const member = await Member.findById(memberId);
      //   console.log(member)

      if (member) {
        const client = new Client({ email, firstName, lastName, memberId });

        await client.save();

        member.clients.push(memberId);

        await member.save();
        return member.populate("clients");
      } else {
        throw new UserInputError("member does not exist.");
      }
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Mutation };
