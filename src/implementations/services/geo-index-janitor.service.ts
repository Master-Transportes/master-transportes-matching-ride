import type { Redis } from "ioredis";
import { DRIVER_KEYS } from "../../config/keys-cache.js";
import { logger } from "../../utils/logger.js";

const SCAN_COUNT = 100;
const RUN_INTERVAL_MS = 60_000;

export function startGeoIndexJanitor(redis: Redis): NodeJS.Timeout {
  const timer = setInterval(() => {
    void cleanGeoIndex(redis);
  }, RUN_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

async function cleanGeoIndex(redis: Redis): Promise<void> {
  try {
    let cursor = "0";
    const stale: string[] = [];

    do {
      const [nextCursor, members] = await redis.zscan(
        DRIVER_KEYS.LOCATION_SET,
        cursor,
        "COUNT",
        SCAN_COUNT,
      );
      cursor = nextCursor;
      for (const member of members ?? []) {
        const driverId = member[0];
        if (typeof driverId !== "string") continue;
        const exists = await redis.exists(DRIVER_KEYS.LOCATION(driverId));
        if (exists === 0) stale.push(driverId);
      }
    } while (cursor !== "0");

    if (stale.length > 0) {
      const pipeline = redis.pipeline();
      for (const driverId of stale) {
        pipeline.zrem(DRIVER_KEYS.LOCATION_SET, driverId);
      }
      await pipeline.exec();
      logger.info({ count: stale.length }, "Geo index cleaned stale drivers");
    }
  } catch (err) {
    logger.error({ err }, "Geo index janitor failed");
  }
}
