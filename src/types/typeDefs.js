import { gql } from "apollo-server-core";

const typeDefs = gql`
  enum StageType {
    NOT_STARTED
    STARTED
    FINISHED
  }

  type Contract {
    id: ID!
    client: Client!
    member: Member!
    eta: String!
    stage: StageType!
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
    isActive: Boolean!
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
    members: [Member!]!
    contracts: [Contract!]!
    createdAt: String!
    updatedAt: String!
  }

  type Stats {
    id: ID!
    notStarted: Int!
    started: Int!
    finished: Int!
  }

  type File {
    fileName: String!
    mimetype: String!
    encoding: String!
  }

  type EmailSignUp {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
  }
  
  type Service {
    id: ID!
    name: [String]!
    photoUrl: String!
    price: Float!
    description: String!
  }

  input CreateEmailInput {
    firstName: String!
    lastName: String!
    email: String!
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

  input CreateServiceInput {
    name: String!
    photoUrl: [String]!
    price: Float!
    description: String!
   }


  type Query {
    emails: [EmailSignUp]!
    hello: String!
    members: [Member!]!
    clients: [Client!]!
    contracts: [Contract!]!
    contractById(id: ID): Contract!
    memberById(id: ID!): Member!
    memberStatsById(id: ID!): Stats!
    clientByEmail(email: String!): Client!
    services: [!Service]!
  }

  type Mutation {
    createEmail(data: CreateEmailInput!): EmailSignUp!
    createMember(data: CreateMemberInput!): Member!
    createClient(data: CreateClientInput!): Client!
    createContract(data: CreateContractInput!): Contract!
    createService(data: CreateServiceInput!): Service!
    updateService(data: UpdateServiceInput!): Service!
    deleteService(data: DeleteServiceInput!): Service!
  }

  type User {
    id: ID!
    firstName: String!
    lastName: String!
    dob: String!
    email: String!
    password: String!
    address: String!
  }

  type Query {
    users: [User!]!
  }

  type Mutation {
    signup(
      firstName: String!
      lastName: String!
      dob: String!
      email: String!
      password: String!
      address: String!
    ): User!
  }
`;

export default typeDefs;
