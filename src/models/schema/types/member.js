// member.js

import { gql } from 'apollo-server-core';

const memberTypeDefs = gql`
  type Member {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    isActive: Boolean!
    clients: [Client!]!
    contracts: [Contract!]!
    acceptedTos: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  input CreateMemberInput {
    email: String!
    firstName: String!
    lastName: String!
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
