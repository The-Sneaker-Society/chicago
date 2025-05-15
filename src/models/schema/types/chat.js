import { gql } from "apollo-server-core";

const chatTypeDefs = gql`
  enum MessageSenderType {
    USER
    MEMBER
  }

  type Chat {
    id: ID!
    name: String!
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
  }

  input CreateChatInput {
    name: String!
    userId: String!
  }

  input CreateMessageInput {
    chatId: String!
    content: String!
    senderType: MessageSenderType!
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
  }

  type Subscription {
    subscribeToChat(data: SubscribeToChatInput): Message!
    hello: String!
  }
`;

export default chatTypeDefs;
