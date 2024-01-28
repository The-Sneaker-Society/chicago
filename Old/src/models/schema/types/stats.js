// stats.js

import { gql } from 'apollo-server-core';

const statsTypeDefs = gql`
  type Stats {
    id: ID!
    notStarted: Int!
    started: Int!
    finished: Int!
  }
`;

export default statsTypeDefs;
