import { gql } from "apollo-server-core";

const postTypeDefs = gql`
  type Post {
    id: ID!
    member: PublicMember!
    content: String
    mediaUrls: [String!]!
    mediaType: String!
    likeCount: Int!
    isLikedByMe: Boolean!
    commentCount: Int!
    shareCount: Int!
    createdAt: String!
  }

  type PostComment {
    id: ID!
    member: PublicMember!
    content: String!
    createdAt: String!
  }

  type PostPage {
    items: [Post!]!
    hasMore: Boolean!
    nextOffset: Int
  }

  type CommentPage {
    items: [PostComment!]!
    hasMore: Boolean!
    nextOffset: Int
  }

  input CreatePostInput {
    content: String
    mediaUrls: [String!]
    mediaType: String
  }

  extend type Query {
    getMySocietyFeed(limit: Int, offset: Int): PostPage!
    getPostComments(postId: ID!, limit: Int, offset: Int): CommentPage!
  }

  extend type Mutation {
    createPost(data: CreatePostInput!): Post!
    deletePost(postId: ID!): Boolean!
    likePost(postId: ID!): Boolean!
    unlikePost(postId: ID!): Boolean!
    sharePost(postId: ID!): Boolean!
    addComment(postId: ID!, content: String!): PostComment!
  }
`;

export default postTypeDefs;
