import { gql } from "apollo-server-core";

const typeDefs = gql`
  type Chat {
    id: ID!
    name: String!
    member: Member!
    client: Client!
    messages: [Message!]!
  }

  interface Participant {
    id: ID!
  }

  type Message {
    id: ID!
    chatId: String!
    content: String!
    senderId: String!
    createdAt: String!
    senderType: MessageSenderType!
  }

  input CreateMessageInput {
    chatId: String!
    content: String!
    senderId: String!
    senderType: MessageSenderType!
  }

  enum StageType {
    NOT_STARTED
    STARTED
    FINISHED
  }

  enum MessageSenderType {
    USER
    MEMBER
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
    name: String!
  }

  input CreateEmailInput {
    name: String!
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

  input CreateChatInput {
    name: String!
    memberId: String!
    clientId: String!
  }

  input ChatSubscriptionInput {
    chatId: ID!
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
    currentNumber: Int
    newMessage: Message!
    messages: [Message!]!
    getChatById(chatId: ID!): Chat!
  }

  type Mutation {
    createEmail(data: CreateEmailInput!): EmailSignUp!
    createMember(data: CreateMemberInput!): Member!
    createClient(data: CreateClientInput!): Client!
    createContract(data: CreateContractInput!): Contract!
    createMessage(data: CreateMessageInput): Message!
    createChat(data: CreateChatInput): Chat!
  }

  type Subscription {
    numberIncremented: Int
    subscribeToChat(data: ChatSubscriptionInput): Message!
  }
`;

export default typeDefs;
