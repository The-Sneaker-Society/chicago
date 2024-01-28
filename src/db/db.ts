// src/db.ts
import mongoose, { Connection } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: 'config.env' });

const DATABASE_URL = process.env.ATLAS_URI;

const connectDb = (): Promise<Connection> => {
  return mongoose.connect(DATABASE_URL!, {
    dbName: 'sneaker-society',
    autoIndex: true,
  })
  .then(() => {
    console.log('Connected to DB...');
    return mongoose.connection;
  })
  .catch((err) => {
    console.log('Connection to DB failed', err);
    throw err;
  });
};

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error'));

export default connectDb;
