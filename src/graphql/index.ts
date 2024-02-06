import { gql } from 'apollo-server-express';
import emailSignUpTypeDefs from './emails/email.typesDefs';
import emailSignUpResolvers from './emails/email.resolvers';

export const typeDefs = gql`
  ${emailSignUpTypeDefs}
`;

export const resolvers = [emailSignUpResolvers];
