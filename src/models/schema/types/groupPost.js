import { gql } from "apollo-server-core";

const groupPostTypeDefs = gql`
  type GroupPost {
    id: ID!
    groupId: ID!
    author: Member
    content: String!
    images: [String!]!
    likes: [Member!]!
    commentCount: Int!
    createdAt: String
    commentsPage(limit: Int = 10, offset: Int = 0): PostCommentPage!
  }

  type GroupPostPage {
    items: [GroupPost!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  extend type Query {
    getPostsByGroup(
      groupId: ID!
      limit: Int = 10
      offset: Int = 0
    ): GroupPostPage!
  }

  extend type Mutation {
    createPost(groupId: ID!, content: String!, images: [String!]): GroupPost
    updatePost(postId: ID!, content: String!, images: [String!]): GroupPost
    deletePost(postId: ID!): Boolean
    likePost(postId: ID!): GroupPost
  }
`;

export default groupPostTypeDefs;
