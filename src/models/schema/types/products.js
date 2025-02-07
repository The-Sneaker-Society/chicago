import { gql } from 'apollo-server-core';

const productTypeDefs = gql`
  type Product {
    id: ID!
    stripeProductId: String!
    stripePriceId: String!
    member: Member!
    price: Int!
    description: String!
    name: String!
  }

  type Query {
    products: [Product]!
  }

  type Mutation {
    resumeAccountOnboarding: String!
    onboardMemberToStripe: String!
    createProduct(name: String!, price: Int!, description: String!): Boolean!
    createProductPaymentLink(productId: String!): String!
    createMemberPaymentLink(productId: String!): String!
    deleteProductById(id: ID!): Boolean!
  }
`;

export default productTypeDefs;
