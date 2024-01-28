// contract.js

import { gql } from 'apollo-server-core';

const contractTypeDefs = gql`
  enum StageType {
    NOT_STARTED
    STARTED
    FINISHED
  }

  type Contract {
    id: ID!
    client: Client!
    member: Member!
    eta: String!
    stage: StageType!
    price: String!
    notes: String!
    photos: [String!]
    reported: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  input CreateContractInput {
    client: String!
    memberId: String!
    eta: String!
    stage: String!
    price: String!
    notes: String!
    photos: [String!]
    reported: Boolean!
  }

  type Query {
    contracts: [Contract!]!
    contractById(id: ID): Contract!
  }

  type Mutation {
    createContract(data: CreateContractInput!): Contract!
  }
`;

export default contractTypeDefs;
