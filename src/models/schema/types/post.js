import { gql } from "apollo-server-core";

const postTypeDefs = gql`
  type Post {
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

  type PostPage {
    items: [Post!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  extend type Query {
    getPostsByGroup(groupId: ID!, limit: Int = 10, offset: Int = 0): PostPage!
  }

  extend type Mutation {
    createPost(groupId: ID!, content: String!, images: [String!]): Post
    updatePost(postId: ID!, content: String!, images: [String!]): Post
    deletePost(postId: ID!): Boolean
    likePost(postId: ID!): Post
  }
`;

export default postTypeDefs;
