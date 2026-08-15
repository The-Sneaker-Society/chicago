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
    joinGroup(groupId: ID!): Group
    leaveGroup(groupId: ID!): Group

    addGroupAdmin(groupId: ID!, memberId: ID!): Group
    removeGroupAdmin(groupId: ID!, memberId: ID!): Group
    removeGroupMember(groupId: ID!, memberId: ID!): Group
  }
`;

export default groupTypeDefs;
