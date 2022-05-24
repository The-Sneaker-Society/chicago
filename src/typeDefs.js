import { gql } from "apollo-server-core";

const typeDefs = gql`
  type Member {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    clients: [Client!]!
  }

  type Client {
    id: ID!
    email: String!
    firstName: String
    lastName: String!
    memberId: ID!
    member: Member!
  }

  input CreateMemberInput {
    email: String!
    firstName: String!
    lastName: String!
  }

  input CreateClientInput {
    email: String!
    firstName: String!
    lastName: String!
    memberId: String!
  }

  type Query {
    hello: String!
    members: [Member!]!
    clients: [Client!]!
  }

  type Mutation {
    createMember(data: CreateMemberInput!): Member!
    creatClient(data: CreateClientInput!): Client!
  }
`;

export default typeDefs;
