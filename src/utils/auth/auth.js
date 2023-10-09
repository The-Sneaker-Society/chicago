import { authFirebase } from '../firebaseUtils/authFire';
import { AuthenticationError } from 'apollo-server-core';
import MemberModel from '../../models/Member.model';
import ClientModel from '../../models/Client.model';
export const authorizeUser = async ({ req }) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];

      const user = await authFirebase(token);

      // look up user in db
      const dbUser = await MemberModel.find({
        firebaseId: user.uid,
        deletedAt: null,
      });

      const clientUser = await ClientModel.find({
        firebaseId: user.uid,
        deletedAt: null,
      });

      if (dbUser.length === 0 && clientUser.length === 0) {
        throw new AuthenticationError('Member not found');
      }
      return dbUser[0] || clientUser[0];
    } catch (error) {
      throw error;
    }
  } else {
    throw new AuthenticationError('Authorization header not present');
  }
};
