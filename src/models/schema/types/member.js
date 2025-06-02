import { gql } from "apollo-server-core";

const memberTypeDefs = gql`
  type Member {
    id: ID!
    firebaseId: String!
    email: String!
    businessName: String
    firstName: String!
    lastName: String!
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
    stripeConnectAccountId: String
    stripeCustomerId: String
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
    isNewUser: Boolean!
    isSubscribed: Boolean!
    isOnboardedWithStripe: Boolean!
    chats: [Chat]!
  }

  type SyncStripeDataResult {
    success: Boolean!
  }

  type QrWidgetData {
    image: String!
    url: String!
  }

  type StripeWidgetData {
    percentChange: Float!
    nextPayoutDate: String!
    payoutAmount: String!
    stripeConnectAccountId: String
  }

  type SubscriptionDetails {
    status: String
    currentPeriodEnd: String
    paymentMethod: PaymentMethod
  }

  type PaymentMethod {
    brand: String
    last4: String
  }

  input CreateMemberInput {
    clerkId: String!
    email: String
    firstName: String
    lastName: String
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
  }

  input UpdateMemberInput {
    subscriptionId: String
    email: String
    businessName: String
    firstName: String
    lastName: String
    phoneNumber: String
    addressLineOne: String
    addressLineTwo: String
    zipcode: String
    state: String
    isNewUser: Boolean
  }

  # Queries
  type Query {
    members: [Member!]!
    memberById(id: ID!): Member!
    currentMember: Member!
    memberQrWidget: QrWidgetData!
    stripeWidgetData: StripeWidgetData!
    subscriptionDetails: SubscriptionDetails!
  }

  # Mutations
  type Mutation {
    createMember(data: CreateMemberInput!): Member!
    createMemberSubsctiprion: String
    cancelSubscription: Boolean!
    updateMember(data: UpdateMemberInput!): Boolean!
    reactivateSubscription: Boolean!
    onboardMemberToStripe: String!
    resumeAccountOnboarding: String!
    deleteMember: Boolean!
    syncStripeData: SyncStripeDataResult!
  }
`;

export default memberTypeDefs;
