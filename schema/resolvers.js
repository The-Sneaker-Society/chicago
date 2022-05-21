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
};

export default resolvers;
