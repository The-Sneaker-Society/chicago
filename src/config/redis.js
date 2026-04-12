import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config({ path: "config.env" });

const redisUrl = process.env.REDIS_URL;

const redisConfig = redisUrl
  ? { 
      url: redisUrl,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      reconnectOnError(err) {
        const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
        if (targetErrors.some(e => err.message.includes(e))) {
          return true;
        }
        return false;
      }
    }
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
