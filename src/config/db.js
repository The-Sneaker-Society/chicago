import mongoose from "mongoose";
mongoose.set('strictQuery', false);
import dotenv from "dotenv";

dotenv.config({ path: "config.env" });

const DATABASE_URL = process.env.ATLAS_URI;

const connectDb = () => {
  return mongoose.connect(
    DATABASE_URL,
    {
      dbName: "sneaker-society",
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
    },
    (err) => {
      if (err) {
        console.log("Connection to DB failed");
      } else {
        console.log("Connected to DB...");
      }
    }
  );
};

const db = mongoose.connection;

db.on("error", console.error.bind(console, "MongoDB connetion error"));

module.exports = connectDb;
