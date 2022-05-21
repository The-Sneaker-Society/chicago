import { gql } from "apollo-server-express";

const typeDefs = gql`
  type Member {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
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

  type Mutation {
    createMember(data: MemberInput!): Member!
  }
`;

export default typeDefs;
