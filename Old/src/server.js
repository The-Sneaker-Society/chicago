import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import express from 'express';
import cors from 'cors';
import http from 'http';
import typeDefs from './models/schema/index';
import resolvers from './resolvers';
import connectDb from './config/db';
import { authorizeUser } from './utils/auth/auth';

async function startApolloServer() {
  const app = express();
  app.use(cors());

  app.get('/', (req, res) => {
    res.send('hello world');
  });

  const httpServer = http.createServer(app);

  connectDb();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError: (error) => {
      if (error.message.startsWith('Database error: ')) {
        return new Error('Internal server error');
      }
      return error;
    },
    context: authorizeUser,
  });

  await server.start();
  server.applyMiddleware({ app });
  httpServer.listen({ port: process.env.PORT || 4000 });
  console.log(`🚀 Server ready at ${server.graphqlPath}`);
}

// Start the server
startApolloServer();
