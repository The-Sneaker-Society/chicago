import { gql } from "apollo-server-core";

const groupTypeDefs = gql`
 type Group {
   id: ID!
   name: String!
   description: String
   avatar: String
   members: [User!]!
   createdAt: String
 }


 type User {
   id: ID!
   name: String!
   email: String!
 }


 type Query {
   getGroup(id: ID!): Group
   getGroups: [Group!]!
 }


 type Mutation {
   createGroup(
     name: String!
     description: String
     avatar: String
     memberIds: [ID!]
   )
 }
`;

export default groupTypeDefs;
