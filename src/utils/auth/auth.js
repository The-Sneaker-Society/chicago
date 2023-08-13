import { authFirebase } from '../firebaseUtils/authFire';
import { AuthenticationError } from 'apollo-server-core';
import MemberModel from '../../models/Member.model';

export const authorizeUser = async ({ req }) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];

      const user = await authFirebase(token);

      // look up user in db
      const dbUser = await MemberModel.find({ firebaseId: user.uid });

      if (!dbUser) {
        throw new AuthenticationError('Member not found');
      }
      return { dbUser };
    } catch (error) {
      throw new AuthenticationError('Invalid Auth Token');
    }
  } else {
    throw new AuthenticationError('Authorization header not present');
  }
};
