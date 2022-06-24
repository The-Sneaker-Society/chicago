import { ApolloServer, gql } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import cors from "cors";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import typeDefs from "./typeDefs";
import resolvers from "./resolvers";
import { uploadImage } from "./utils/ImageUpload";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3 } from "aws-sdk";

dotenv.config({ path: "./config.env" });

async function startApolloServer(typeDefs, resolvers) {
  const app = express();
  app.use(cors());

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

  app.post("/upload", upload.array("files", 3), function (req, res, next) {
    res.send({
      message: "Uploaded!",
      urls: req.files.map(function (file) {
        return {
          url: file.location,
          name: file.key,
          type: file.mimetype,
          size: file.size,
        };
      }),
    });
  });
  // const upload = multer({ dest: "uploads/" });
  // app.post("/photo", upload.single("file"), uploadImage);

  // const upload = multer({ dest: "uploads/" });

  // const multiUpload = upload.fields([{ name: "shoes", maxCount: 2 }]);
  // app.post("/photo", multiUpload, uploadImage);

  const httpServer = http.createServer(app);

  await mongoose
    .connect(process.env.ATLAS_URI, {
      dbName: "sneaker-society",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Connected to DB....");
    });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();
  server.applyMiddleware({ app });
  await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
}

// Start the server
startApolloServer(typeDefs, resolvers);
