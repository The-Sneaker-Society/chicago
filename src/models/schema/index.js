import { gql } from "apollo-server-core";
import clientTypeDefs from "./types/client";
import memberTypeDefs from "./types/member";
import contractTypeDefs from "./types/contract";
import statsTypeDefs from "./types/stats";
import emailSignUpTypeDefs from "./types/emailSignup";
import productTypeDefs from "./types/products";
import userTypeDefs from "./types/user";
const typeDefs = gql`
  ${clientTypeDefs}
  ${memberTypeDefs}
  ${contractTypeDefs}
  ${productTypeDefs}
  ${userTypeDefs}
#   ${statsTypeDefs}
#   ${emailSignUpTypeDefs}
`;

export default typeDefs;
