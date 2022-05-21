import { gql } from "apollo-server-express";

const typeDefs = gql`
  type Member {
    id: ID!
    firstName: String!
    lastName: String!
  }

  type Query {
    hello: String
    helloMe: String
    getAllMembers: [Member!]
  }
`;

export default typeDefs;
