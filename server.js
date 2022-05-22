import express from "express";
import { ApolloServer, gql } from "apollo-server-express";
import resolvers from "./schema/resolvers";
import typeDefs from "./schema/typeDefs";
import mongoose from "mongoose";
import dotenv from "dotenv";

async function startServer() {
  const app = express();
  const apolloServer = new ApolloServer({
    typeDefs: typeDefs,
    resolvers: resolvers,
  });

  dotenv.config({ path: "./config.env" });

  await apolloServer.start();

  apolloServer.applyMiddleware({ app: app });

  app.use((req, res) => {
    res.send("Hello from express apollo server");
  });

  await mongoose
    .connect(process.env.ATLAS_URI, {
      dbName: "sneaker-society",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Connected to DB....");
    });

  app.listen(4000, () => {
    console.log(`Server is running on port ${4000}...`);
  });
}

try {
  startServer();
} catch (e) {
  console.log(e);
}
