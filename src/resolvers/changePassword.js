const resolvers = {
  Mutation: {
    changePassword: async (
      _,
      { currentPassword, newPassword, confirmPassword }
    ) => {
      return {
        success: true,
        message: "Password changed successfully!",
      };
    },
  },
};
