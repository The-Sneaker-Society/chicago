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
    photos: [String!]
    reported: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Member {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    clients: [Client!]!
    contracts: [Contract!]!
    createdAt: String!
    updatedAt: String!
  }

  type Client {
    id: ID!
    email: String!
    firstName: String
    lastName: String!
    memberId: ID!
    member: Member!
    contracts: [Contract!]!
    createdAt: String!
    updatedAt: String!
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

  input CreateContractInput {
    client: String!
    memberId: String!
    eta: String!
    stage: String!
    price: String!
    notes: String!
    photos: [String!]
    reported: Boolean!
  }

  type Query {
    hello: String!
    members: [Member!]!
    clients: [Client!]!
    contracts: [Contract!]!
    memberById(id: ID!): Member!
  }

  type Mutation {
    createMember(data: CreateMemberInput!): Member!
    creatClient(data: CreateClientInput!): Client!
    createContract(data: CreateContractInput!): Contract!
  }
`;

export default typeDefs;
