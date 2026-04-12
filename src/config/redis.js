import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config({ path: "config.env" });

const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;

  if (redisUrl) {
    return { 
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
    };
  }

  if (redisHost) {
    return {
      host: redisHost,
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    };
  }

  return null;
};

const redisConfig = getRedisConfig();
const redis = redisConfig ? new Redis(redisConfig) : null;

if (redis) {
  redis.on("connect", () => {
    console.log("Connected to Redis");
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err);
  });
} else {
  console.log("Redis not configured - skipping connection");
}

export default redis;
