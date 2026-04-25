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

  type CommentPage {
    items: [PostComment!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  type Post {
    id: ID!
    groupId: ID!
    author: Member!
    content: String!
    images: [String!]!
    likes: [Member!]!
    comments: [PostComment!]!
    commentCount: Int!
    commentsPage(limit: Int = 10, offset: Int = 0): CommentPage!
    shares: Int
    createdAt: String
  }

  type PostPage {
    items: [Post!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  type Query {
    getGroup(id: ID!): Group
    getGroups: [Group!]!
    getGroupsForUser(userId: ID!): [Group!]!
    getPostsByGroup(groupId: ID!, limit: Int = 10, offset: Int = 0): PostPage!
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

    createPost(groupId: ID!, content: String!, images: [String!]): Post
    updatePost(postId: ID!, content: String!, images: [String!]): Post
    deletePost(postId: ID!): Boolean
    likePost(postId: ID!): Post

    addComment(postId: ID!, content: String!): PostComment
    updateComment(postId: ID!, commentId: ID!, content: String!): PostComment
    deleteComment(postId: ID!, commentId: ID!): Boolean
  }
`;

export default groupTypeDefs;