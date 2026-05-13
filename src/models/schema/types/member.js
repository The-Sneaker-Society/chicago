import { gql } from "apollo-server-core";

const memberTypeDefs = gql`
  type Member {
    addressLineOne: String
    addressLineTwo: String
    businessName: String
    chats: [Chat]!
    clients: [Client!]!
    contracts: [Contract!]!
    contractsDisabled: Boolean!
    createdAt: String!
    deletedAt: String
    email: String!
    firstName: String
    followers: [Member!]!
    following: [Member!]!
    id: ID!
    isActive: Boolean!
    isNewUser: Boolean!
    isOnboardedWithStripe: Boolean!
    isSubscribed: Boolean!
    lastName: String
    phoneNumber: String
    products: [Product]!
    qrWidgetData: QrWidgetData!
    state: String
    stripeConnectAccountId: String!
    stripeCustomerId: String
    updatedAt: String!
    zipcode: String
  }

  type SyncStripeDataResult {
    success: Boolean!
  }

  type QrWidgetData {
    image: String!
    url: String!
    contractsDisabled: Boolean!
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

  type DiscoverMemberPage {
    items: [Member!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  # Queries
  type Query {
    members: [Member!]!
    memberById(id: ID!): Member!
    currentMember: Member!
    memberQrWidget: QrWidgetData!
    stripeWidgetData: StripeWidgetData!
    subscriptionDetails: SubscriptionDetails!
    getDiscoverMembers(limit: Int, offset: Int): DiscoverMemberPage!
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
    followMember(memberId: ID!): Boolean!
    unfollowMember(memberId: ID!): Boolean!
  }
`;

export default memberTypeDefs;
