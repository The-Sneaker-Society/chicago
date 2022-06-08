import { ApolloServer, gql } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import http from "http";
import typeDefs from "./types/typeDefs";
import resolvers from "./resolvers";
import connectDb from "./config/db";
import functions from "firebase-functions";
import admin from "firebase-admin";
import serviceAccount from "./functions/sneaker-society-firebase-adminsdk-3v528-fc3f4e7773.json";

async function verify(idToken) {
  try {
    if (idToken) {
      // const newToken = idToken.replace("Bearer ", "");

      let user = await admin
        .auth()
        .verifyIdToken(idToken)
        .then((decodedToken) => {
          return decodedToken;
        })
        .catch((e) => {
          throw new Error(e);
        });
      return user;
    } else {
      throw new Error("Missing Token");
    }
  } catch (e) {
    throw new Error(e);
  }
}

async function startApolloServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const token =
    "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFhZWY1NjlmNTI0MTRlOWY0YTcxMDRiNmQwNzFmMDY2ZGZlZWQ2NzciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxhbmlzIFlhdGVzIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FBVFhBSnhMTVkzblJtTW93UFdsVF84SExqenpxajF3dEItN0JDU0dhQXFxPXM5Ni1jIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3NuZWFrZXItc29jaWV0eSIsImF1ZCI6InNuZWFrZXItc29jaWV0eSIsImF1dGhfdGltZSI6MTY1NDY1MDI5MiwidXNlcl9pZCI6IkZmc09uU1R4UVhhQkxQTzFwTUZTMUxhcTJqSDMiLCJzdWIiOiJGZnNPblNUeFFYYUJMUE8xcE1GUzFMYXEyakgzIiwiaWF0IjoxNjU0NjUwMjkyLCJleHAiOjE2NTQ2NTM4OTIsImVtYWlsIjoiYWxhbmlzeWF0ZXM5NkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwODk0NzM3NjkyODc5NDI1MDY0MSJdLCJlbWFpbCI6WyJhbGFuaXN5YXRlczk2QGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.JEQmqUeZRrpEQAYfCNuC44a6NnGCdI24ch7bvHRrnr-UPfiQ-41lPZp4Z8adRAqlI8cHDty_7ArLv6K64avzVkzXL0OXYMlU8tiMT4DFD1RL-k6A7euzLsfyHCW-53Q6wCXnLrtpIyK3SDEI-VR-kDQd8BThs32Acwh5WSuOq_5u8Sz2ytwFXksUGiaZF5sUOKF3snyF6rIgA-6ErpgcMpgUW2RUCW0zDRm2WMODFnvr-QC86_hAh73Tlcuj0CnbJJFLtFLrKa0MxJGCJRehdIj6ytN_UykKQyUfNVcIekS772RmQabhygKgbCixJDJup97zGK4GOl-6cRQIIJkGVQ";

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  connectDb();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    context: async ({ req }) => {
      try {
        if (!req.headers.authorization) {
          throw new Error("Missing Token");
        }

        const user = await verify(req.headers.authorization);

        return user;
      } catch (e) {
        throw new Error(e);
      }
    },
  });

  await server.start();
  server.applyMiddleware({ app });
  await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
}

// Start the server
startApolloServer();
