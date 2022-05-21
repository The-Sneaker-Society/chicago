import { gql } from "apollo-server-express";

const typeDefs = gql`
  type Member {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
    createdAt: String
    updatedAt: String
  }

  type Query {
    hello: String
    helloMe: String
    getAllMembers: [Member!]
  }

  input MemberInput {
    firstName: String!
    lastName: String!
    email: String!
  }

  input UpdateMemberInput {
    firstName: String
    lastName: String
    email: String
  }

  type Mutation {
    createMember(data: MemberInput!): Member!
    updateMember(data: UpdateMemberInput!): Member!
  }
`;

export default typeDefs;
