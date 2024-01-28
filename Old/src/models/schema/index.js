import clientTypeDefs from './types/client';
import memberTypeDefs from './types/member';
import contractTypeDefs from './types/contract';
import statsTypeDefs from './types/stats';
import emailSignUpTypeDefs from './types/emailSignup';
import { gql } from 'apollo-server-core';

const typeDefs = gql`
  ${clientTypeDefs}
  ${memberTypeDefs}
  ${contractTypeDefs}
#   ${statsTypeDefs}
#   ${emailSignUpTypeDefs}
`;

export default typeDefs;
