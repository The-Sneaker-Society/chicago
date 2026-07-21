// stats.js

import { gql } from 'apollo-server-core';

const statsTypeDefs = gql`
  type Stats {
    id: ID!
    pendingReview: Int!
    priceProposed: Int!
    priceAccepted: Int!
    waitingShipment: Int!
    shipped: Int!
    arrivedAtMember: Int!
    workInProgress: Int!
    processingReturn: Int!
    shippedBack: Int!
    userReceived: Int!
    payoutReleased: Int!
  }
`;

export default statsTypeDefs;
