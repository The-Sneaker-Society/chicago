// contract.js

import { gql } from "apollo-server-core";

const contractTypeDefs = gql`
  enum StageType {
    NOT_STARTED
    PENDING_REVIEW
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
    trackingNumber: TrackingDetails
    timeline: TimelineDetails
    shippingCarrier: String
    paymentStatus: String
    createdAt: String
    updatedAt: String
  }

  type TrackingDetails {
    carrier: String
    trackingNumber: String
  }

  type TimelineDetails {
    event: String
    date: String
  }

  type PhotoDetail {
    url: String!
    note: String
  }

  type PhotoDetails {
    leftSide: [PhotoDetail]
    rightSide: [PhotoDetail]
    topView: [PhotoDetail]
    bottomView: [PhotoDetail]
    frontView: [PhotoDetail]
    backView: [PhotoDetail]
    other: [PhotoDetail]
  }

  type ShoeDetails {
    brand: String
    model: String
    color: String
    size: String
    soleCondition: String
    material: String
    year: String
    returnTimeframe: String
    odorLevel: String
    previousRepairs: Boolean
    previousRepairsNotes: String
    photos: PhotoDetails
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
    year: String
    returnTimeframe: String
    odorLevel: String
    previousRepairs: Boolean
    previousRepairsNotes: String
    photos: PhotoInput
  }

  input PhotoInputItem {
    url: String!
    note: String
  }

  input PhotoInput {
    leftSide: [PhotoInputItem]
    rightSide: [PhotoInputItem]
    topView: [PhotoInputItem]
    bottomView: [PhotoInputItem]
    frontView: [PhotoInputItem]
    backView: [PhotoInputItem]
    other: [PhotoInputItem]
  }

  input CreateContractPriceInput {
    contractId: ID!
    price: Int!
  }

  input RepairDetailsInput {
    clientNotes: String
  }

  input UpdateContractInput {
    memberId: ID
    shoeDetails: ShoeDetailsInput
    repairDetails: RepairDetailsInput
    proposedPrice: Float
    price: Float
    status: String
    trackingNumber: TrackingDetailsInput
    timeline: [TimelineDetailsInput]
    shippingCarrier: String
    paymentStatus: String
  }

  input TrackingDetailsInput {
    carrier: String
    trackingNumber: String
  }

  input TimelineDetailsInput {
    event: String
    date: String
  }

  type ContractListItem {
    id: ID!
    name: String!
    status: StageType!
    createdAt: String!
  }

  type Query {
    contracts: [Contract!]!
    contractById(id: ID): Contract!
    memberContractStatus: MemberContractStatus!
    getContractList: [ContractListItem!]!
  }

  type Mutation {
    createContract(data: CreateContractInput!): Contract!
    createContractPrice(data: CreateContractPriceInput): String!
    updateContract(id: ID!, data: UpdateContractInput!): Boolean!
  }
`;

export default contractTypeDefs;
