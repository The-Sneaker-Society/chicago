import { authFirebase } from "../firebaseUtils/authFire";
import { ApolloError, AuthenticationError } from "apollo-server-core";
import MemberModel from "../../models/Member.model";
import UserModel from "../../models/User.model";
export const authorizeUser = async ({ req }) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    try {
      const token = authHeader.split(" ")[1];

      if (!token) {
        throw new Error("Unauthorized");
      }

      const user = await authFirebase(token);

      // look up user in db
      const dbMember = await MemberModel.find({
        firebaseId: user.uid,
        deletedAt: null,
      });

      const dbUser = await UserModel.find({
        firebaseId: user.uid,
        deletedAt: null,
      });

      // // Need a away to dertimne a Member or User.........
      if (dbMember.length === 0 && dbUser.length === 0) {
        console.log("No member but is verified");
        return;
      }
      return dbMember[0] || dbUser[0];
    } catch (error) {
      throw error;
    }
  } else {
    throw new AuthenticationError("Authorization header not present");
  }
};
