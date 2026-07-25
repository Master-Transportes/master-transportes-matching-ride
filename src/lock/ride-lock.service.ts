import crypto from "crypto";
import { redis } from "../redis/client.js";
import { MATCHING } from "../constants.js";

const RENEW_LUA = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("EXPIRE", KEYS[1], ARGV[2])
  end
  return 0
`;

const RELEASE_LUA = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

function lockKey(rideId: string): string {
  return `lock:ride:${rideId}`;
}

export interface LockHandle {
  token: string;
  rideId: string;
  renewalTimer?: ReturnType<typeof setInterval>;
}

export const rideLock = {
  async acquire(rideId: string): Promise<LockHandle | null> {
    const token = crypto.randomUUID();
    const result = await redis.call(
      "SET",
      lockKey(rideId),
      token,
      "NX",
      "EX",
      String(MATCHING.LOCK_TTL),
    );
    if (result === null) return null;

    const handle: LockHandle = { token, rideId };

    handle.renewalTimer = setInterval(async () => {
      try {
        await redis.eval(RENEW_LUA, 1, lockKey(rideId), token, String(MATCHING.LOCK_TTL));
      } catch {
        // renewal failed — lock may have been lost
      }
    }, MATCHING.LOCK_RENEWAL_INTERVAL);

    return handle;
  },

  async release(handle: LockHandle | null): Promise<void> {
    if (!handle) return;

    if (handle.renewalTimer) {
      clearInterval(handle.renewalTimer);
      handle.renewalTimer = undefined;
    }

    await redis.eval(RELEASE_LUA, 1, lockKey(handle.rideId), handle.token);
  },
};
