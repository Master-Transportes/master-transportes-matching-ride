import type { Redis } from "ioredis";
import { ACCEPT_OFFER_LUA } from "../scripts/accept-offer.lua.js";
import { CLOSE_OFFER_LUA } from "../scripts/close-offer.lua.js";
import { CANCEL_OFFER_LUA } from "../scripts/cancel-offer.lua.js";
import { withRetry } from "../../utils/retry.js";
import { OFFER_KEYS, RIDE_KEYS, DRIVER_KEYS } from "../../config/keys-cache.js";
import type {
  IOfferRepository,
  AcceptOfferResult,
  CloseOfferResult,
  CancelOfferResult,
} from "../../contracts/IOfferRepository.js";

export function createRedisOfferRepository(redis: Redis): IOfferRepository {
  return {
    async createOffer(
      offerId: string,
      rideId: string,
      driverId: string,
      createdAt: number,
      expiresAt: number,
    ): Promise<void> {
      await redis
        .pipeline()
        .hset(OFFER_KEYS.OFFER(offerId), {
          rideId,
          driverId,
          status: "pending",
          createdAt: createdAt.toString(),
          expiresAt: expiresAt.toString(),
        })
        .expire(OFFER_KEYS.OFFER(offerId), Math.ceil((expiresAt - createdAt) / 1000))
        .hset(RIDE_KEYS.MATCHING_STATE(rideId), {
          state: "WAITING_RESPONSE",
          currentOfferId: offerId,
          currentDriverId: driverId,
          createdAt: createdAt.toString(),
        })
        .sadd(RIDE_KEYS.CONTACTED_DRIVERS(rideId), driverId)
        .expire(RIDE_KEYS.MATCHING_STATE(rideId), 3600)
        .expire(RIDE_KEYS.CONTACTED_DRIVERS(rideId), 3600)
        .hset(DRIVER_KEYS.PROFILE(driverId), "status", "busy")
        .exec();
    },

    async acceptOffer(
      offerId: string,
      rideId: string,
      driverId: string,
    ): Promise<AcceptOfferResult> {
      const result = (await withRetry(() =>
        redis.eval(
          ACCEPT_OFFER_LUA,
          2,
          OFFER_KEYS.OFFER(offerId),
          RIDE_KEYS.MATCHING_STATE(rideId),
          driverId,
        ),
      )) as [number, string];

      if (result[0] === 1) return { success: true };
      return {
        success: false,
        reason: result[1] as AcceptOfferResult["success"] extends true
          ? never
          : "OFFER_NOT_PENDING",
      };
    },

    async closeOffer(
      offerId: string,
      rideId: string,
      driverId: string,
      newStatus: "rejected" | "expired",
    ): Promise<CloseOfferResult> {
      const result = (await withRetry(() =>
        redis.eval(
          CLOSE_OFFER_LUA,
          2,
          OFFER_KEYS.OFFER(offerId),
          RIDE_KEYS.MATCHING_STATE(rideId),
          driverId,
          newStatus,
        ),
      )) as [number, string];

      if (result[0] === 1) return { success: true };
      return {
        success: false,
        reason: result[1] as CloseOfferResult["success"] extends true ? never : "OFFER_NOT_PENDING",
      };
    },

    async cancelOffer(
      offerId: string,
      rideId: string,
      finishedAt: string,
    ): Promise<CancelOfferResult> {
      const result = (await withRetry(() =>
        redis.eval(
          CANCEL_OFFER_LUA,
          2,
          OFFER_KEYS.OFFER(offerId),
          RIDE_KEYS.MATCHING_STATE(rideId),
          finishedAt,
        ),
      )) as [number, string];

      if (result[0] === 1) return { success: true };
      return {
        success: false,
        reason: result[1] as CancelOfferResult["success"] extends true
          ? never
          : "RIDE_ALREADY_MATCHED",
      };
    },

    async getOfferStatus(offerId: string): Promise<string | null> {
      return redis.hget(OFFER_KEYS.OFFER(offerId), "status");
    },

    async getOfferStatusAndDriver(offerId: string): Promise<[string | null, string | null]> {
      return redis.hmget(OFFER_KEYS.OFFER(offerId), "status", "driverId") as Promise<
        [string | null, string | null]
      >;
    },
  };
}
