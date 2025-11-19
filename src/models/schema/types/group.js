import { gql } from "apollo-server-core";

const groupTypeDefs = gql`
  type Group {
    id: ID!
    name: String!
    description: String
    avatar: String
    members: [User!]!
    createdAt: String
    updatedAt: String
  }

  input CreateGroupInput {
    name: String!
    description: String
    avatar: String
    members: [ID!]
  }

  input UpdateGroupInput {
    id: ID!
    name: String
    description: String
    avatar: String
    members: [ID!]
  }

  # Queries
  type Query {
    groups: [Group!]!
    groupById(id: ID!): Group!
  }

  # Mutations
  type Mutation {
    createGroup(data: CreateGroupInput!): Group!
    updateGroup(data: UpdateGroupInput!): Boolean!
    deleteGroup(id: ID!): Boolean!
    addMemberToGroup(groupId: ID!, userId: ID!): Boolean!
    removeMemberFromGroup(groupId: ID!, userId: ID!): Boolean!
  }
`;

export default groupTypeDefs;
