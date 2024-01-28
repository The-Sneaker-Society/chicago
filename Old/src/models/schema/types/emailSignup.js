// emailSignUp.js

import { gql } from 'apollo-server-core';

const emailSignUpTypeDefs = gql`
  type EmailSignUp {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
  }

  input CreateEmailInput {
    firstName: String!
    lastName: String!
    email: String!
  }
`;

export default emailSignUpTypeDefs;
