import Member from "../models/Members.model";
import Client from "../models/Client.model";

const resolvers = {
  Query: {
    hello: () => {
      return "Hello World";
    },
    getAllMembers: async () => {
      const members = await Member.find();
      return members;
    },
    getAllClients: async () => {
      const clients = await Client.find();
      return clients;
    },
  },
  Mutation: {
    createMember: async (parent, args, ctx, info) => {
      const { firstName, lastName, email } = args.data;

      const foundMember = await Member.findOne({ email: email });

      if (foundMember !== null) {
        throw new Error("Someone with that email already exists.");
      }

      const member = new Member({ firstName, lastName, email });
      await member.save();
      return member;
    },
    updateMember: async (parent, args, ctx, info) => {
      const { firstName, lastName, email } = args.data;
      const member = await Member.findByIdAndUpdate(
        args.id,
        {
          email,
          lastName,
          firstName,
        },
        { new: true }
      );

      return member;
    },
    createClient: async (parent, args, ctx, info) => {
      const { firstName, lastName, email, members } = args.data;
      const foundClient = await Client.findOne({ email: email });

      if (foundClient !== null) {
        throw new Error("Someone with that email already exists.");
      }

      const client = new Client({ email, firstName, lastName, members });
      await client.save();

      return client;
    },
  },
};

export default resolvers;
