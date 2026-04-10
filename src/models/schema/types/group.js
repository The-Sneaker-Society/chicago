import { gql } from "apollo-server-core";

const groupTypeDefs = gql`
  type Group {
    id: ID!
    name: String!
    description: String
    avatar: String
    members: [Member!]!
    createdAt: String
    updatedAt: String
    createdBy: Member!
    admins: [Member!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Query {
    getGroup(id: ID!): Group
    getGroups: [Group!]!
    getGroupsForUser(userId: ID!): [Group!]!
  }

  type Mutation {
    createGroup(
      name: String!
      description: String
      avatar: String
      memberIds: [ID!]
    ): Group

    updateGroup(
      id: ID!
      name: String
      description: String
      avatar: String
      memberIds: [ID!]
    ): Group

    deleteGroup(id: ID!): Boolean
  }
`;

export default groupTypeDefs;
