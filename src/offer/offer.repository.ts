import { redis } from "../redis/client.js";
import { ACCEPT_OFFER_LUA } from "./accept-offer.lua.js";
import { CLOSE_OFFER_LUA } from "./close-offer.lua.js";
import { CANCEL_OFFER_LUA } from "./cancel-offer.lua.js";
import { withRetry } from "../utils/retry.js";
import { REDIS } from "../constants.js";

export type AcceptOfferResult =
  | { success: true }
  | {
      success: false;
      reason:
        | "OFFER_NOT_PENDING"
        | "DRIVER_MISMATCH"
        | "RIDE_NOT_WAITING"
        | "RIDE_ALREADY_MATCHED"
        | "RIDE_CANCELLED";
    };

export type CloseOfferResult =
  | { success: true }
  | {
      success: false;
      reason: "OFFER_NOT_PENDING" | "DRIVER_MISMATCH" | "RIDE_ALREADY_MATCHED" | "RIDE_CANCELLED";
    };

export type CancelOfferResult =
  { success: true } | { success: false; reason: "RIDE_ALREADY_MATCHED" | "RIDE_NOT_WAITING" };

export const offerRepository = {
  async createOffer(
    offerId: string,
    rideId: string,
    driverId: string,
    createdAt: number,
    expiresAt: number,
  ): Promise<void> {
    await redis
      .pipeline()
      .hset(REDIS.OFFER(offerId), {
        rideId,
        driverId,
        status: "pending",
        createdAt: createdAt.toString(),
        expiresAt: expiresAt.toString(),
      })
      .expire(REDIS.OFFER(offerId), Math.ceil((expiresAt - createdAt) / 1000))
      .hset(REDIS.MATCHING(rideId), {
        state: "WAITING_RESPONSE",
        currentOfferId: offerId,
        currentDriverId: driverId,
        createdAt: createdAt.toString(),
      })
      .sadd(REDIS.CONTACTED(rideId), driverId)
      .expire(REDIS.MATCHING(rideId), 3600)
      .expire(REDIS.CONTACTED(rideId), 3600)
      .hset(REDIS.DRIVER(driverId), "status", "busy")
      .exec();
  },

  async acceptOffer(offerId: string, rideId: string, driverId: string): Promise<AcceptOfferResult> {
    const result = (await withRetry(() =>
      redis.eval(ACCEPT_OFFER_LUA, 2, REDIS.OFFER(offerId), REDIS.MATCHING(rideId), driverId),
    )) as [number, string];

    if (result[0] === 1) return { success: true };
    return {
      success: false,
      reason: result[1] as AcceptOfferResult["success"] extends true ? never : "OFFER_NOT_PENDING",
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
        REDIS.OFFER(offerId),
        REDIS.MATCHING(rideId),
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
      redis.eval(CANCEL_OFFER_LUA, 2, REDIS.OFFER(offerId), REDIS.MATCHING(rideId), finishedAt),
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
    return redis.hget(REDIS.OFFER(offerId), "status");
  },
};
