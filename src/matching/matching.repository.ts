import { redis } from "../redis/client.js";
import { env } from "../config/env.js";
import { withRetry } from "../utils/retry.js";
import { CREATE_RIDE_LUA } from "../offer/create-ride.lua.js";
import { REDIS, MATCHING } from "../constants.js";
import type { RideRequestedEvent } from "../domain/types.js";

export const matchingRepository = {
  async createRideState(event: RideRequestedEvent): Promise<{ created: boolean }> {
    const result = (await withRetry(() =>
      redis.eval(
        CREATE_RIDE_LUA,
        2,
        REDIS.RIDE(event.rideId),
        REDIS.MATCHING(event.rideId),
        event.passengerId,
        event.pickupLat.toString(),
        event.pickupLng.toString(),
        event.dropoffLat.toString(),
        event.dropoffLng.toString(),
        env.MATCHING_INITIAL_RADIUS.toString(),
        String(MATCHING.INITIAL_TTL),
      ),
    )) as [number, string];

    return { created: result[0] === 1 };
  },

  async getRideData(rideId: string): Promise<Record<string, string>> {
    const data = await redis.hgetall(REDIS.RIDE(rideId));
    return data ?? {};
  },

  async getMatchingField(rideId: string, field: string): Promise<string | null> {
    return redis.hget(REDIS.MATCHING(rideId), field);
  },

  async setMatchingField(rideId: string, field: string, value: string): Promise<void> {
    await redis.hset(REDIS.MATCHING(rideId), field, value);
  },

  async getContactedDrivers(rideId: string): Promise<string[]> {
    return redis.smembers(REDIS.CONTACTED(rideId));
  },

  async deleteRideState(rideId: string): Promise<void> {
    await redis
      .pipeline()
      .del(REDIS.RIDE(rideId))
      .del(REDIS.MATCHING(rideId))
      .del(REDIS.CONTACTED(rideId))
      .exec();
  },
};
