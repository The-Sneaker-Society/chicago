import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";

const Mutation = {
  async updateProfile(parent, args, ctx, info) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        address1,
        address2,
        zipcode,
        state,
      } = args.data;

      // Find the user profile based on some identifier (e.g., user ID)
      const userProfile = await MemberModel.findById(ctx.userId); // Assuming you have user authentication and ctx.userId is available

      if (!userProfile) {
        throw new UserInputError("User profile not found");
      }

      // Update the user profile fields if provided
      if (firstName !== undefined) {
        userProfile.firstName = firstName;
      }
      if (lastName !== undefined) {
        userProfile.lastName = lastName;
      }
      if (email !== undefined) {
        userProfile.email = email;
      }
      if (phone !== undefined) {
        userProfile.phone = phone;
      }
      if (address1 !== undefined) {
        userProfile.address1 = address1;
      }
      if (address2 !== undefined) {
        userProfile.address2 = address2;
      }
      if (zipcode !== undefined) {
        userProfile.zipcode = zipcode;
      }
      if (state !== undefined) {
        userProfile.state = state;
      }

      // Save the updated user profile
      const updatedProfile = await userProfile.save();

      return updatedProfile;
    } catch (e) {
      throw new Error(e);
    }
  },
};
export default { Mutation };
