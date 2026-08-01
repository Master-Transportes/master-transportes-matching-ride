import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 5000),
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error({ err }, "Redis error"));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}
