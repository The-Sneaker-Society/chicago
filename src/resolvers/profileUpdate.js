const resolvers = {
  Mutation: {
    updateProfile: async (
      _,
      { firstName, LastName, phone, address1, address2, email }
    ) => {
      return {
        success: true,
        message: "Profile updated successfully!",
      };
    },
  },
};
