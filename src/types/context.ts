import Redis from "ioredis";

export interface AppContext {
  userId: string;
  role: string;
  dbUser: unknown;
  redis: Redis;
}
