import { ApolloServer, gql } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import cors from "cors";
import http from "http";
import typeDefs from "./types/typeDefs";
import resolvers from "./resolvers";
import connectDb from "./config/db";
import { uploadImage } from "./utils/ImageUpload";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3 } from "aws-sdk";
import { authFirebase } from "./firebaseUtils/authFire";
import { GraphQLError } from "graphql";

async function startApolloServer() {
  const app = express();
  app.use(cors());
  // test
  // const s3 = new S3();

  // const upload = multer({
  //   storage: multerS3({
  //     s3: s3,
  //     bucket: process.env.AWS_BUCKET_NAME,
  //     metadata: function (req, file, cb) {
  //       cb(null, { fieldName: file.fieldname });
  //     },
  //     key: function (req, file, cb) {
  //       cb(null, Date.now().toString());
  //     },
  //   }),
  //   limits: { fileSize: 52428800 },
  // });

  // app.post("/upload", upload.array("files", 3), function (req, res, next) {
  //   res.send({
  //     message: "Uploaded!",
  //     urls: req.files.map(function (file) {
  //       return {
  //         url: file.location,
  //         name: file.key,
  //         type: file.mimetype,
  //         size: file.size,
  //       };
  //     }),
  //   });
  // });

  app.get("/", (req, res) => {
    res.send("hello world");
  });

  // const upload = multer({ dest: "uploads/" });
  // app.post("/photo", upload.single("file"), uploadImage);

  // const upload = multer({ dest: "uploads/" });
  // app.post("/upload", upload.array("files", 5), uploadImage);

  const httpServer = http.createServer(app);

  connectDb();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    // context: async ({ req, res }) => {
    //   try {
    //     // const token = req.headers.authorization || "";
    //     const token =
    //       "eyJhbGciOiJSUzI1NiIsImtpZCI6ImY4MDljZmYxMTZlNWJhNzQwNzQ1YmZlZGE1OGUxNmU4MmYzZmQ4MDUiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxhbmlzIFlhdGVzIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FMbTV3dTNicm9zcTZKN3NPZE5xR2o2cjZQcmFRX1Q2YUNYdEllZ0paNks4PXM5Ni1jIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3NuZWFrZXItc29jaWV0eSIsImF1ZCI6InNuZWFrZXItc29jaWV0eSIsImF1dGhfdGltZSI6MTY2ODk4ODk3MCwidXNlcl9pZCI6ImNOTmhlQ1VWakxNR05PTUVMZUdZWlhqdVl4bDIiLCJzdWIiOiJjTk5oZUNVVmpMTUdOT01FTGVHWVpYanVZeGwyIiwiaWF0IjoxNjY4OTg4OTcwLCJleHAiOjE2Njg5OTI1NzAsImVtYWlsIjoiYWxhbmlzLnlhdGVzQHRoZXNuZWFrZXJzc29jaWV0eS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwODY2NDY4Njc3MjA3NDQwNTAzMCJdLCJlbWFpbCI6WyJhbGFuaXMueWF0ZXNAdGhlc25lYWtlcnNzb2NpZXR5LmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.SOOY_JXIFWqDdyGJ5baB8-7d8Y6a4ENt-OiHkwwLBw-39iSC25GudDmpKwDtoS5b_LVxg0RUF9Tq25mQIm7VGZChzZN19SZpWPbehgeIE4zM53rqfi1d98Uatu7PFWYRwgvMxlb6iEdU-FuyrEU162JFFjkkfmkbGbspVDKurGGQzdBqX9x5QRmY86BSAvKiG4YCVJsRwEDtmdb19XYtLvnF_LbLEOjILe1TKcfA0mfDH1H9-WPDs--u3O2JsSppNZONox8eAt7-Jbz0x8p-93VeECIl6kEHtGiiBVI2EwFrYzf-qkEaIWnX3kXWoNpi3x0TVlNqunNMdNZZDLbT4Q";
    //     const user = await authFirebase(token);

    //     if (!user) {
    //       throw new GraphQLError("User Not Authenticated", {
    //         extensions: {
    //           code: "UNAUTENICATED",
    //           http: { status: 401 },
    //         },
    //       });
    //     }

    //     return { user };
    //   } catch (e) {
    //     throw e;
    //   }
    // },
  });

  await server.start();
  server.applyMiddleware({ app });
  httpServer.listen({ port: process.env.PORT || 4000 });
  console.log(`🚀 Server ready at ${server.graphqlPath}`);
}

// Start the server
startApolloServer();
