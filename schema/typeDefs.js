import { gql } from "apollo-server-express";

const typeDefs = gql`
  type Client {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    members: [ID!]!
    createdAt: String!
    updatedAt: String!
  }

  type Member {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
    clients: [Client!]!
    createdAt: String
    updatedAt: String
  }

  type Query {
    hello: String
    helloMe: String
    getAllMembers: [Member!]
    getAllClients: [Client!]
  }

  input MemberInput {
    firstName: String!
    lastName: String!
    email: String!
  }

  input ClientInput {
    firstName: String!
    lastName: String!
    email: String!
    members: [ID!]!
  }

  input UpdateMemberInput {
    firstName: String
    lastName: String
    email: String
  }

  type Mutation {
    createMember(data: MemberInput!): Member!
    updateMember(id: ID!, data: UpdateMemberInput!): Member!
    createClient(data: ClientInput!): Client!
  }
`;

export default typeDefs;
