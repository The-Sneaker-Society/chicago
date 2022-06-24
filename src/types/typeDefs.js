import { gql } from "apollo-server-core";

const typeDefs = gql`
  type Contract {
    id: ID!
    client: Client!
    member: Member!
    eta: String!
    stage: String!
    price: String!
    notes: String!
    reported: Boolean!
  }

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

  type File {
    fileName: String!
    mimetype: String!
    encoding: String!
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
    contracts: [Contract!]!
  }

  type Mutation {
    createMember(data: CreateMemberInput!): Member!
    creatClient(data: CreateClientInput!): Client!
  }


`;

export default typeDefs;
