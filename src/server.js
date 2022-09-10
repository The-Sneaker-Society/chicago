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
import { fireAuth } from "./firebaseUtils/test";
// const admin = require("firebase-admin");

// admin.initializeApp();

async function startApolloServer() {
  const app = express();
  app.use(cors());
  // test
  const s3 = new S3();

  const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.AWS_BUCKET_NAME,
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        cb(null, Date.now().toString());
      },
    }),
    limits: { fileSize: 52428800 },
  });

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

  // const upload = multer({ dest: "uploads/" });
  // app.post("/photo", upload.single("file"), uploadImage);

  // const upload = multer({ dest: "uploads/" });
  app.post("/upload", upload.array("files", 5), uploadImage);

  const httpServer = http.createServer(app);

  connectDb();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    // context: async ({ req }) => {
    //   try {
    //     const token = req.headers.authorization || "";
    //     const user = await fireAuth(token);
    //     return user;
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
