import express, { Application } from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import connectDb from './db/db';
import { resolvers, typeDefs } from './graphql';

const startServer = async () => {
  const app: Application = express();

  // Connect to the database
  try {
    await connectDb();
    console.log('Connected to the database');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    return;
  }

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (error) => {
      if (error.message.startsWith('Database error: ')) {
        return new Error('Internal server error');
      }
      return error;
    },
  });

  await server.start();

  server.applyMiddleware({ app } as any);

  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(
      `Server running at http://localhost:${PORT}${server.graphqlPath}`
    );
  });
};

startServer();
