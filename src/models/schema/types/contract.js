// contract.js

import { gql } from "apollo-server-core";

const contractTypeDefs = gql`
  enum StageType {
    NOT_STARTED
    STARTED
    FINISHED
  }

  type MemberContractStatus {
    notStarted: String!
    started: String!
    finished: String!
  }

  type Contract {
    id: ID!
    client: Client!
    member: Member!
    chatId: ID
    shoeDetails: ShoeDetails
    repairDetails: RepairDetails
    proposedPrice: Float
    price: Float
    status: String
    trackingNumber: String
    shippingCarrier: String
    paymentStatus: String
    createdAt: String
    updatedAt: String
  }
  type ShoeDetails {
    brand: String
    model: String
    color: String
    size: String
    soleCondition: String
    material: String
    photos: [String]
  }

  type RepairDetails {
    clientNotes: String
    memberNotes: String
  }

  input CreateContractInput {
    memberId: ID!
    shoeDetails: ShoeDetailsInput!
    repairDetails: RepairDetailsInput!
  }

  input ShoeDetailsInput {
    brand: String
    model: String
    color: String
    size: String
    soleCondition: String
    material: String
    photos: [String]
  }

  input RepairDetailsInput {
    clientNotes: String
  }

  type Query {
    contracts: [Contract!]!
    contractById(id: ID): Contract!
    memberContractStatus: MemberContractStatus!
  }

  type Mutation {
    createContract(data: CreateContractInput!): Contract!
  }
`;

export default contractTypeDefs;
