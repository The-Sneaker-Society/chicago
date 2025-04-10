import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config({ path: "config.env" });

const redisUrl = process.env.REDIS_URL;

console.log({
  redisUrl,
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD,
});

const redisConfig = redisUrl
  ? { url: redisUrl }
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
    };

const redis = new Redis(redisConfig);

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redis;
