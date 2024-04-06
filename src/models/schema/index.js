import clientTypeDefs from './types/client';
import memberTypeDefs from './types/member';
import contractTypeDefs from './types/contract';
import statsTypeDefs from './types/stats';
import emailSignUpTypeDefs from './types/emailSignup';
import { gql } from 'apollo-server-core';
import productTypeDefs from './types/products';

const typeDefs = gql`
  ${clientTypeDefs}
  ${memberTypeDefs}
  ${contractTypeDefs}
  ${productTypeDefs}
#   ${statsTypeDefs}
#   ${emailSignUpTypeDefs}
`;

export default typeDefs;
