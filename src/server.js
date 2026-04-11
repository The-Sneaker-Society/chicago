import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import cors from "cors";
import http from "http";
import typeDefs from "./models/schema/index";
import resolvers from "./resolvers";
import connectDb from "./config/db";
import { clearkAuthorizeUser } from "./utils/auth/auth";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import redis from "./config/redis";
import { handleStripeWebhook } from "./stripe/stripeWebhookHandler";
import { checkEnvVars } from "./utils/checkVars";

async function startApolloServer() {
  checkEnvVars([
    "REDIS_HOST",
    "REDIS_PORT",
    "CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "STRIPE_API_KEY",
    "STRIPE_MEMBER_SUBSCRIPTION_ID",
    "ATLAS_URI",
    "REACT_APP_URL",
  ]);
  const app = express();

  app.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );

  app.use(cors());

  app.use(clerkMiddleware());

  // DEV: allow impersonation via header or env for local testing only
  if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      const devUser = req.headers['x-dev-user-id'] || process.env.DEV_USER_ID;
      if (devUser) {
        req.auth = req.auth || {};
        req.auth.userId = devUser;
        req.auth.sessionId = req.auth.sessionId || 'dev-session';
      }
      next();
    });
  }

  app.use((req, res, next) => {
    if (req.path !== "/webhook") {
      return requireAuth()(req, res, next);
    }
    next(); // Skip requireAuth for /webhook
  });

  app.get("/", (req, res) => {
    res.send("hello world");
  });

  app.post(
    "/webhook",
    (req, res, next) => {
      console.log("Using req.rawBody");
      next();
    },
    handleStripeWebhook
  );

  const httpServer = http.createServer(app);

  const schema = new makeExecutableSchema({ typeDefs, resolvers });

  connectDb();

  const wsServer = new WebSocketServer({
    // This is the `httpServer` we created in a previous step.
    server: httpServer,
    // Pass a different path here if app.use
    // serves expressMiddleware at a different path
    path: "/subscriptions",
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    csrfPrevention: true,
    cache: "bounded",
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
    context: async (integrationContext) => {
      const authContext = await clearkAuthorizeUser(integrationContext);
      return {
        ...authContext,
        redis,
      };
    },
  });

  await server.start();
  server.applyMiddleware({ app });
  httpServer.listen({ port: process.env.PORT || 4000 });
  console.log(`🚀 Server ready at ${server.graphqlPath}`);
}

// Start the server
startApolloServer();
