import { gql } from "apollo-server-core";

const imageTypeDefs = gql`
  type UploadTicket {
    uploadUrl: String!
    key: String!
  }

  type Image {
    id: ID!
    userId: String!
    key: String!
    filename: String
    fileType: String
    createdAt: String
    url: String
  }

  type Query {
    getUserImages: [Image!]!
    getImage(id: ID!): Image
  }

  type Mutation {
    requestImageUpload(filename: String!, fileType: String): UploadTicket!
    confirmImageUpload(key: String!, filename: String, fileType: String): Image!
    updateImage(id: ID!, filename: String, fileType: String): Image!
    deleteImage(id: ID!): Boolean!
  }
`;

export default imageTypeDefs;
