import { gql } from 'apollo-server-core';

const emailSignUpTypeDefs = gql`
  type EmailSignUp {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
  }

  type Query {
    emails: [EmailSignUp]
  }

  type Mutation {
    addEmail(data: CreateEmailInput!): Boolean
  }

  input CreateEmailInput {
    firstName: String!
    lastName: String!
    email: String!
  }
`;

export default emailSignUpTypeDefs;
