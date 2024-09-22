// member.js

import { gql } from "apollo-server-core";

const userTypeDefs = gql`
  type User {
    id: ID!
    firebaseId: String!
    email: String!
    isNewUser: Boolean!
    userType: String!
    firstName: String!
    lastName: String!
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
    contracts: [Contract]
  }

  input CreateUserInput {
    firebaseId: String!
    email: String!
  }

  input UpdateUserInput {
    subscriptionId: String
    email: String
    isNewUser: Boolean
    firstName: String
    lastName: String
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
  }

  # Queries
  type Query {
    users: [User!]!
    currentUser: User!
  }

  # Mutations
  type Mutation {
    createUser(data: CreateUserInput!): User!
    updateUser(data: UpdateUserInput!): Boolean!
  }
`;

export default userTypeDefs;
