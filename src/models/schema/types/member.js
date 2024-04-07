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
    products: [Product]!
    acceptedTos: Boolean!
    subscriptionId: ID
    createdAt: String!
    updatedAt: String!
    deletedAt: String
    qrWidgetData: QrWidgetData!
  }

  type QrWidgetData {
    image: String!
    url: String!
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

  input UpdateMemberInput {
    subscriptionId: String
    email: String
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
    members: [Member!]!
    memberById(id: ID!): Member!
    currentMember: Member!
    # memberQrWidget: QrWidgetData!
  }

  # Mutations
  type Mutation {
    createMember(data: CreateMemberInput!): Member!
    updateMember(data: UpdateMemberInput!): Boolean!
    deleteMember: Boolean!
  }
`;

export default memberTypeDefs;
