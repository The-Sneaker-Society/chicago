import Member from "../models/Members.model";

const resolvers = {
  Query: {
    hello: () => {
      return "Hello World yo";
    },
    getAllMembers: async () => {
      const members = await Member.find();
      return members;
    },
    helloMe() {
      return "yoyo";
    },
  },
  Mutation: {
    createMember: async (parent, args, ctx, info) => {
      const { firstName, lastName, email } = args.data;
      const member = new Member({ firstName, lastName, email });
      await member.save();
      return member;
    },
    updateMember: async (parent, args, ctx, info) => {
      const { firstName, lastName, email } = args.data;
    },
  },
};

export default resolvers;
