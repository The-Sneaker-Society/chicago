import { gql } from "apollo-server-core";

const vaultTypeDefs = gql`
  type Vault {
    id: ID!
    member: PublicMember!
    title: String!
    description: String
    category: String!
    platforms: [String!]!
    mediaUrls: [String!]!
    thumbnailUrl: String
    status: String!
    isApproved: Boolean!
    isFeatured: Boolean!
    publishedAt: String
    consentAccepted: Boolean!
    adminNotes: String
    createdAt: String!
    updatedAt: String!
  }

  type VaultPage {
    items: [Vault!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  input CreateVaultSubmissionInput {
    title: String!
    description: String
    category: String!
    platforms: [String!]
    mediaUrls: [String!]!
    thumbnailUrl: String
    consentAccepted: Boolean!
    status: String
  }

  input UpdateVaultSubmissionInput {
    title: String
    description: String
    category: String
    platforms: [String!]
    mediaUrls: [String!]
    thumbnailUrl: String
  }

  extend type Query {
    vaultSubmissions: [Vault!]!
    vaultSubmissionById(id: ID!): Vault
    adminVaultQueue(status: String, limit: Int, offset: Int): VaultPage!
  }

  extend type Mutation {
    createVaultSubmission(data: CreateVaultSubmissionInput!): Vault!
    updateVaultSubmission(id: ID!, data: UpdateVaultSubmissionInput!): Vault!
    deleteVaultSubmission(id: ID!): Boolean!
    approveVaultSubmission(id: ID!, notes: String): Vault!
    rejectVaultSubmission(id: ID!, notes: String!): Vault!
    featureVaultSubmission(id: ID!, featured: Boolean!): Vault!
    publishVaultSubmission(id: ID!): Vault!
  }
`;

export default vaultTypeDefs;
