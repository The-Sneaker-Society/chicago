import { gql } from "apollo-server-core";

const commentTypeDefs = gql`
  type PostComment {
    id: ID!
    author: Member
    content: String!
    createdAt: String
  }

  type PostCommentPage {
    items: [PostComment!]!
    totalCount: Int!
    hasMore: Boolean!
    nextOffset: Int
  }

  extend type Mutation {
    addComment(postId: ID!, content: String!): PostComment
    updateComment(postId: ID!, commentId: ID!, content: String!): PostComment
    deleteComment(postId: ID!, commentId: ID!): Boolean
  }
`;

export default commentTypeDefs;
