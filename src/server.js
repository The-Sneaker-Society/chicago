import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import cors from "cors";
import http from "http";
import typeDefs from "./models/schema/index";
import resolvers from "./resolvers";
import connectDb from "./config/db";
import { clearkAuthorizeUser } from "./utils/auth/auth";
import { handleStripeSubscriptionCreated } from "./stripe/stripeSubscriptions";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import redis from "./config/redis";

async function startApolloServer() {
  const app = express();
  app.use(cors());

  app.use(clerkMiddleware());
  app.use(requireAuth());

  app.get("/", (req, res) => {
    res.send("hello world");
  });

  app.post(
    "/webhook",
    express.json({ type: "application/json" }),
    (request, response) => {
      const event = request.body;
      let subscription;
      let status;
      // Handle the event
      switch (event.type) {
        case "payment_intent.succeeded":
          const paymentIntent = event.data.object;
          // Then define and call a method to handle the successful payment intent.
          // handlePaymentIntentSucceeded(paymentIntent);
          break;
        case "payment_method.attached":
          const paymentMethod = event.data.object;
          // Then define and call a method to handle the successful attachment of a PaymentMethod.
          // handlePaymentMethodAttached(paymentMethod);
          break;
        case "customer.subscription.created":
          subscription = event.data.object;
          status = subscription.status;
          console.log(`Subscription status is ${status}.`);
          // Then define and call a method to handle the subscription created.
          // handleSubscriptionCreated(subscription);
          handleStripeSubscriptionCreated({
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            subscriptionStatus: subscription.status,
          });
          break;
        // ... handle other event types
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      // Return a response to acknowledge receipt of the event
      response.json({ received: true });
    }
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
        redis, // Use the imported Redis client
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
