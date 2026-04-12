import Redis from "ioredis";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "config.env") });

const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;
  const isProduction = process.env.NODE_ENV === "production";

  if (redisUrl) {
    return {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    };
  }

  if (redisHost && !isProduction) {
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

  if (isProduction && !redisUrl && !redisHost) {
    console.log("Redis not configured in production - skipping connection");
    return null;
  }

  return null;
};

const redisUrl = process.env.REDIS_URL;
const redisConfig = getRedisConfig();
const redis = redisConfig
  ? redisUrl
    ? new Redis(redisUrl, redisConfig)
    : new Redis(redisConfig)
  : null;

if (redis) {
  redis.on("ready", () => {
    console.log("Connected to Redis");
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err);
  });
} else {
  console.log("Redis not configured - skipping connection");
}

export default redis;
