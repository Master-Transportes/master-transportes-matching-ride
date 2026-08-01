import type { Redis } from "ioredis";
import { withRetry } from "../../utils/retry.js";
import { CREATE_RIDE_LUA } from "../scripts/create-ride.lua.js";
import { RIDE_KEYS } from "../../config/keys-cache.js";
import { MATCHING } from "../../config/constants.js";
import type { Env } from "../../config/env.js";
import type { IMatchingRepository } from "../../contracts/IMatchingRepository.js";
import type { RideRequestedEvent } from "../../domain/types.js";

export function createRedisMatchingRepository(redis: Redis, env: Env): IMatchingRepository {
  return {
    async createRideState(event: RideRequestedEvent): Promise<{ created: boolean }> {
      const result = (await withRetry(() =>
        redis.eval(
          CREATE_RIDE_LUA,
          2,
          RIDE_KEYS.RIDE(event.rideId),
          RIDE_KEYS.MATCHING_STATE(event.rideId),
          event.passengerId, // ARGV[1]
          event.origin.lat, // ARGV[2]
          event.origin.lng, // ARGV[3]
          event.destination.lat, // ARGV[4]
          event.destination.lng, // ARGV[5]
          env.MATCHING_INITIAL_RADIUS, // ARGV[6] – raio (number)
          MATCHING.INITIAL_TTL, // ARGV[7] – TTL (number)
          event.origin.name, // ARGV[8] – nome origem
          event.destination.name, // ARGV[9] – nome destino
        ),
      )) as [number, string];

      return { created: result[0] === 1 };
    },

    async getRideData(rideId: string): Promise<Record<string, string>> {
      const data = await redis.hgetall(RIDE_KEYS.RIDE(rideId));
      return data ?? {};
    },

    async getMatchingField(rideId: string, field: string): Promise<string | null> {
      return redis.hget(RIDE_KEYS.MATCHING_STATE(rideId), field);
    },

    async setMatchingField(rideId: string, field: string, value: string): Promise<void> {
      await redis.hset(RIDE_KEYS.MATCHING_STATE(rideId), field, value);
    },

    async getContactedDrivers(rideId: string): Promise<string[]> {
      return redis.smembers(RIDE_KEYS.CONTACTED_DRIVERS(rideId));
    },

    async deleteRideState(rideId: string): Promise<void> {
      await redis
        .pipeline()
        .del(RIDE_KEYS.RIDE(rideId))
        .del(RIDE_KEYS.MATCHING_STATE(rideId))
        .del(RIDE_KEYS.CONTACTED_DRIVERS(rideId))
        .exec();
    },
  };
}
