// client.js

import { gql } from 'apollo-server-core';

const clientTypeDefs = gql`
  type Client {
    id: ID!
    email: String!
    firebaseId: String!
    firstName: String!
    lastName: String!
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
    isActive: Boolean!
    members: [Member!]!
    contracts: [Contract!]
    createdAt: String!
    updatedAt: String!
  }

  input CreateClientInput {
    email: String!
    firstName: String!
    lastName: String!
    memberId: String!
  }

  input UpdateClientInput {
    id: String!
    email: String
    firstName: String
    lastName: String
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
    isActive: Boolean
  }

  # Queries
  type Query {
    clients: [Client!]!
    clientByEmail(email: String!): Client!
  }

  # Mutations
  type Mutation {
    createClient(data: CreateClientInput!): Client!
    updateClient(data: UpdateClientInput!): Boolean!
  }
`;

export default clientTypeDefs;
