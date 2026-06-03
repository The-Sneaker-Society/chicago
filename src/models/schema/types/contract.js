// contract.js

import { gql } from "apollo-server-core";

const contractTypeDefs = gql`
  enum StageType {
    PENDING_REVIEW
    PRICE_PROPOSED
    PRICE_ACCEPTED
    WAITING_SHIPMENT
    SHIPPED
    ARRIVED_AT_MEMBER
    WORK_IN_PROGRESS
    PROCESSING_RETURN
    SHIPPED_BACK
    USER_RECEIVED
    PAYOUT_RELEASED
  }

  type MemberContractStatus {
    pendingReview: String!
    priceProposed: String!
    priceAccepted: String!
    waitingShipment: String!
    shipped: String!
    arrivedAtMember: String!
    workInProgress: String!
    processingReturn: String!
    shippedBack: String!
    userReceived: String!
    payoutReleased: String!
  }

  type Contract {
    id: ID!
    client: Client!
    member: Member!
    chatId: ID
    declaredMarketValue: Float
    boxIncluded: Boolean
    shoeDetails: ShoeDetails
    repairDetails: RepairDetails
    proposedPrice: Float
    price: Float
    status: String
    inboundTracking: TrackingDetails
    outboundTracking: TrackingDetails
    unboxingPhotos: [String]
    completionPhotos: [String]
    afterFormNotes: String
    timeline: [TimelineEvent]
    shippingCarrier: String
    paymentStatus: String
    stripePaymentIntentId: String
    stripeTransferId: String
    payoutStatus: String
    payoutAmount: Float
    platformFee: Float
    payoutEligibleAt: String
    paidAt: String
    createdAt: String
    updatedAt: String
  }

  type TrackingDetails {
    carrier: String
    trackingNumber: String
  }

  type TimelineEvent {
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
    inside: [PhotoDetail]
    tongue: [PhotoDetail]
    box: [PhotoDetail]
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
    declaredMarketValue: Float
    boxIncluded: Boolean
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
    inside: [PhotoInputItem]
    tongue: [PhotoInputItem]
    box: [PhotoInputItem]
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
    declaredMarketValue: Float
    boxIncluded: Boolean
    shoeDetails: ShoeDetailsInput
    repairDetails: RepairDetailsInput
    proposedPrice: Float
    price: Float
    status: String
    inboundTracking: TrackingDetailsInput
    outboundTracking: TrackingDetailsInput
    unboxingPhotos: [String]
    completionPhotos: [String]
    afterFormNotes: String
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
    releasePayout(contractId: ID!): Boolean!
  }
`;

export default contractTypeDefs;
