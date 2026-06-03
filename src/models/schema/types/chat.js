import { gql } from "apollo-server-core";

const chatTypeDefs = gql`
  enum MessageSenderType {
    USER
    MEMBER
  }

  enum MessageType {
    TEXT
    PRICE_PROPOSAL
  }

  type PriceProposalMetadata {
    price: Float
    checkoutUrl: String
    status: String
  }

  type Chat {
    id: ID!
    name: String!
    contractId: ID
    member: Member!
    user: User!
    messages: [Message!]!
  }

  type Message {
    id: ID!
    chatId: String!
    content: String!
    senderId: String!
    createdAt: String!
    senderType: MessageSenderType!
    type: MessageType
    metadata: PriceProposalMetadata
  }

  input CreateChatInput {
    name: String!
    userId: String!
  }

  input CreateMessageInput {
    chatId: String!
    content: String!
    senderType: MessageSenderType!
    type: MessageType
    price: Float
    checkoutUrl: String
  }

  input SubscribeToChatInput {
    chatId: ID!
  }

  type Query {
    messages: [Message!]!
    getChatById(chatId: ID!): Chat!
  }

  type Mutation {
    createChat(data: CreateChatInput): Boolean!
    createMessage(data: CreateMessageInput): Message!
    proposePriceInChat(contractId: ID!, price: Float!): Message!
  }

  type Subscription {
    subscribeToChat(data: SubscribeToChatInput): Message!
    hello: String!
  }
`;

export default chatTypeDefs;
