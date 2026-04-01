import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import http from "http";
import typeDefs from "./models/schema/index.js";
// @ts-expect-error - CJS module, will be converted in later phase
import resolvers from "./resolvers/index.js";
// @ts-expect-error - CJS module, will be converted in later phase
import connectDb from "./config/db.js";
import { clearkAuthorizeUser } from "./utils/auth/auth.js";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import redis from "./config/redis.js";
import { handleStripeWebhook } from "./stripe/stripeWebhookHandler.js";
import { checkEnvVars } from "./utils/checkVars.js";
import type { TypedRequest } from "./types/express.js";
import type { AppContext } from "./types/context.js";

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
      verify: (req: TypedRequest, _res: Response, buf: Buffer) => {
        req.rawBody = buf.toString();
      },
    })
  );

  app.use(cors());

  app.use(clerkMiddleware());

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path !== "/webhook") {
      return requireAuth()(req, res, next);
    }
    next();
  });

  app.get("/", (_req: Request, res: Response) => {
    res.send("hello world");
  });

  app.post(
    "/webhook",
    (req: TypedRequest, _res: Response, next: NextFunction) => {
      console.log("Using req.rawBody");
      next();
    },
    handleStripeWebhook
  );

  const httpServer = http.createServer(app);

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  connectDb();

  const wsServer = new WebSocketServer({
    server: httpServer,
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
    context: async ({ req }: { req: Request }) => {
      const authContext = await clearkAuthorizeUser({ req });
      return {
        ...authContext,
        redis,
      };
    },
  });

  await server.start();
  server.applyMiddleware({ app: app as any });
  httpServer.listen({ port: process.env.PORT || 4000 });
  console.log(`Server ready at ${server.graphqlPath}`);
}

startApolloServer();
