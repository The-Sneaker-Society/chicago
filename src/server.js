import { ApolloServer, gql } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import cors from "cors";
import http from "http";
import typeDefs from "./types/typeDefs";
import resolvers from "./resolvers";
import connectDb from "./config/db";

import { authFirebase } from "./firebaseUtils/authFire";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { PubSub } from "graphql-subscriptions";

async function startApolloServer() {
  const app = express();
  app.use(cors());

  app.get("/", (req, res) => {
    res.send("hello world");
  });

  const httpServer = http.createServer(app);

  const schema = new makeExecutableSchema({ typeDefs, resolvers });

  connectDb();

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    formatError: (error) => {
      if (error.message.startsWith("Database error: ")) {
        return new Error("Internal server error");
      }
      return error;
    },
    // context: async ({ req, res }) => {
    //   try {
    //     // const token = req.headers.authorization || "";
    //     const token =
    //       "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk3OGI1NmM2NmVhYmIwZDlhNmJhOGNhMzMwMTU2NGEyMzhlYWZjODciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxhbmlzIFlhdGVzIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FMbTV3dTNrWXhIVHpKSWk2cUJXLUptTDFjN2NDYjNsaE45WWVENmlQOHdKPXM5Ni1jIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3NuZWFrZXItc29jaWV0eSIsImF1ZCI6InNuZWFrZXItc29jaWV0eSIsImF1dGhfdGltZSI6MTY3MDQ1NDI0MCwidXNlcl9pZCI6Ik1DT205RUdIeEVWRVh4MDRpMDRrUWFka29rSjIiLCJzdWIiOiJNQ09tOUVHSHhFVkVYeDA0aTA0a1FhZGtva0oyIiwiaWF0IjoxNjcwNDU0MjQwLCJleHAiOjE2NzA0NTc4NDAsImVtYWlsIjoiYWxhbmlzeWF0ZXM5NkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwODk0NzM3NjkyODc5NDI1MDY0MSJdLCJlbWFpbCI6WyJhbGFuaXN5YXRlczk2QGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.htEF7-IAKGi0Upcn_8fo9KUieJdD_PDBgI2QtF2GgJAVKNDm3z838LP8l4dO3irR39U1srCPQlmbwMnbFk4kfGAvcialncqNXbHB2LHEcZ_RpfibI65VZNc4Oeb6aQdntIQX4gF9qHqAQHU052jsS-JZWz8SayysaFEndA_EWrwQgBNTI1KSnCiYX2zwkV1OLLkSHj57P2CrtwilgI6Uy39Opxq1cVvyvRiWmf2u_9UKLvj5DOKiKyDfHJRcHLNLFZbKFXwGzj5FkP8MMgUGqOJB3_nmozmGumjstPB_y1n1InahWT5ZTfhBK3bTjoCgBy-S4WGXUOEf21DgGw1L6A";
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
