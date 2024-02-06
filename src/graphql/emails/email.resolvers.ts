import { CreateEmailInput } from './email.types';
import { addNewEmail, getAllEmails } from './email.service';

const emailSignUpResolvers = {
  Query: {
    emails: async () => {
      return getAllEmails();
    },
  },
  Mutation: {
    addEmail: async (_: any, { data }: { data: CreateEmailInput }) => {
      const { email, firstName, lastName } = data;

      return addNewEmail(email, firstName, lastName);
    },
  },
};

export default emailSignUpResolvers;
