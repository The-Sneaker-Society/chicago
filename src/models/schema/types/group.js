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

  type PostComment {
    id: ID!
    author: Member!
    content: String!
    createdAt: String
  }

  type Post {
    id: ID!
    groupId: ID!
    author: Member!
    content: String!
    images: [String!]!
    likes: [Member!]!
    comments: [PostComment!]!
    shares: Int
    createdAt: String
  }

  type Query {
    getGroup(id: ID!): Group
    getGroups: [Group!]!
    getGroupsForUser(userId: ID!): [Group!]!
    getPostsByGroup(groupId: ID!): [Post!]!
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

    createPost(groupId: ID!, content: String!, images: [String!]): Post
    deletePost(postId: ID!): Boolean
    likePost(postId: ID!): Post
    addComment(postId: ID!, content: String!): PostComment
  }
`;

export default groupTypeDefs;