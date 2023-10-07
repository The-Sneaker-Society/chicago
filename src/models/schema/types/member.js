// member.js

import { gql } from 'apollo-server-core';

const memberTypeDefs = gql`
  type Member {
    id: ID!
    firebaseId: String!
    email: String!
    firstName: String!
    lastName: String!
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
    isActive: Boolean!
    clients: [Client!]!
    contracts: [Contract!]!
    acceptedTos: Boolean!
    subscriptionId: ID
    createdAt: String!
    updatedAt: String!
  }

  input CreateMemberInput {
    firebaseId: String!
    email: String!
    firstName: String!
    lastName: String!
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
  }

  # Queries
  type Query {
    members: [Member!]!
    memberById(id: ID!): Member!
  }

  # Mutations
  type Mutation {
    createMember(data: CreateMemberInput!): Member!
  }
`;

export default memberTypeDefs;
