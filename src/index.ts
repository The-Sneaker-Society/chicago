import express, { Application } from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import connectDb from './db/db';
import KittenModel from './models/kitten';


const typeDefs = gql`
  type Query {
    hello: String
  }

  type Mutation {
    addKitten: Boolean
  }
`;

const resolvers = {
  Query: {
    hello: () => 'Hello, world!',
  },
  Mutation: {
    addKitten: async () => {
      // Assuming KittenModel has been properly defined and imported
      await KittenModel.create({ name: 'Albert' });
      return true;
    },
  },
};

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

  const server = new ApolloServer({ typeDefs, resolvers });

  await server.start();

  server.applyMiddleware({ app } as any);

  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}${server.graphqlPath}`);
  });
};

startServer();
