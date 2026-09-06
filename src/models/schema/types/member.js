import { gql } from "apollo-server-core";

const memberTypeDefs = gql`
  # Fields safe to expose to other members (no PII, no billing data)
  type PublicMember {
    id: ID!
    firstName: String
    lastName: String
    businessName: String
    state: String
    isActive: Boolean!
    subscriptionStatus: String
    contractsDisabled: Boolean!
  }

  type ServiceMenuItem {
    id: ID!
    name: String!
    price: Float!
    description: String
    isActive: Boolean!
    sortOrder: Int!
  }

  input ServiceMenuItemInput {
    id: ID
    name: String!
    price: Float!
    description: String
    isActive: Boolean
    sortOrder: Int
  }

  type Member {
    addressLineOne: String
    addressLineTwo: String
    city: String
    country: String
    businessName: String
    chats: [Chat]!
    clients: [Client!]!
    contracts: [Contract!]!
    contractsDisabled: Boolean!
    createdAt: String!
    deletedAt: String
    email: String!
    firstName: String
    followers: [PublicMember!]!
    following: [PublicMember!]!
    id: ID!
    isActive: Boolean!
    isNewUser: Boolean!
    isOnboardedWithStripe: Boolean!
    isSubscribed: Boolean!
    lastName: String
    phoneNumber: String
    products: [Product]!
    qrWidgetData: QrWidgetData!
    serviceMenu: [ServiceMenuItem!]!
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
    nextPayoutDate: String
    payoutAmount: String!
    stripeConnectAccountId: String
    previousPayoutAmount: String
    accountStatus: String
    pendingCount: Int
    totalFees: Float
    totalGross: Float
  }

  type RevenueMonthData {
    month: String!
    revenue: Float!
    newContracts: Int!
    completed: Int!
  }

  type RevenueSummaryData {
    months: [RevenueMonthData!]!
    percentChange: Float!
  }

  type SubscriptionDetails {
    status: String
    currentPeriodEnd: String
    paymentMethod: PaymentMethod
    cancelAtPeriodEnd: Boolean
    isPaused: Boolean
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
    city: String
    country: String
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
    city: String
    country: String
    zipcode: String
    state: String
    isNewUser: Boolean
  }

  type DiscoverMemberPage {
    items: [PublicMember!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  # Queries
  type Query {
    members: [Member!]!
    memberById(id: ID!): Member!
    publicMemberById(id: ID!): PublicMember!
    currentMember: Member!
    memberQrWidget: QrWidgetData!
    stripeWidgetData: StripeWidgetData!
    subscriptionDetails: SubscriptionDetails!
    revenueSummary: RevenueSummaryData!
    getDiscoverMembers(limit: Int, offset: Int): DiscoverMemberPage!
    getServiceMenu(memberId: ID!): [ServiceMenuItem!]!
  }

  # Mutations
  type Mutation {
    createMember(data: CreateMemberInput!): Member!
    createMemberSubsctiprion: String
    cancelSubscription: Boolean!
    pauseSubscription: Boolean!
    updateMember(data: UpdateMemberInput!): Boolean!
    reactivateSubscription: Boolean!
    onboardMemberToStripe: String!
    resumeAccountOnboarding: String!
    deleteMember: Boolean!
    syncStripeData: SyncStripeDataResult!
    followMember(memberId: ID!): Boolean!
    unfollowMember(memberId: ID!): Boolean!
    upsertServiceMenu(items: [ServiceMenuItemInput!]!): [ServiceMenuItem!]!
  }
`;

export default memberTypeDefs;
