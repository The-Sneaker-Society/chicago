// member.js

import { gql } from "apollo-server-core";

const userTypeDefs = gql`
  type User {
    id: ID!
    firebaseId: String!
    email: String!
    isNewUser: Boolean!
    userType: String!
  }

  input CreateUserInput {
    firebaseId: String!
    email: String!
  }

  input UpdateUserInput {
    subscriptionId: String
    email: String
    isNewUser: Boolean
  }

  # Queries
  type Query {
    users: [User!]!
    currentUser: User!
  }

  # Mutations
  type Mutation {
    createUser(data: CreateUserInput!): User!
  }
`;

export default userTypeDefs;
