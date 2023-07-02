const resolvers = {
  Query: {
    users: () => User.find(),
  },
  Mutation: {
    signup: async (_, args) => {
      const { firstName, lastName, dob, email, password, address } = args;
      const user = new User({
        firstName,
        lastName,
        dob,
        email,
        password,
        address,
      });
      await user.save();
    },
  },
};
