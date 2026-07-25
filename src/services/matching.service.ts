import { env } from "../config/env.js";
import { h3Service } from "./h3.service.js";
import { offerService } from "../offer/offer.service.js";
import { rideLock } from "../lock/ride-lock.service.js";
import { timeoutService } from "./timeout.service.js";
import { matchingRepository } from "../matching/matching.repository.js";
import {
  publishRideNoDrivers,
  publishRideDriverAccepted,
  publishRideMatchingCancelled,
  publishRideOfferExpired,
} from "../publishers/index.js";
import { logger } from "../utils/logger.js";
import type {
  RideRequestedEvent,
  RideOfferAcceptedEvent,
  RideOfferRejectedEvent,
  RideCancelledEvent,
} from "../domain/types.js";

async function getVersion(rideId: string): Promise<number> {
  const v = await matchingRepository.getMatchingField(rideId, "version");
  return Number(v ?? 0);
}

export const matchingService = {
  async handleRideRequested(event: RideRequestedEvent): Promise<void> {
    const { created } = await matchingRepository.createRideState(event);

    if (!created) {
      logger.warn(`Ride ${event.rideId} already exists — ignoring duplicate ride.requested`);
      return;
    }

    logger.info(`Ride ${event.rideId} v1: → SEARCHING`);

    await this.continueMatching(event.rideId, event.pickupLat, event.pickupLng);
  },

  async handleOfferAccepted(event: RideOfferAcceptedEvent): Promise<void> {
    const result = await offerService.acceptOffer(event.offerId, event.rideId, event.driverId);

    if (!result.success) {
      logger.warn(
        { offerId: event.offerId, driverId: event.driverId, reason: result.reason },
        `Ride ${event.rideId} accept failed`,
      );
      return;
    }

    const v = await getVersion(event.rideId);
    logger.info(
      `Ride ${event.rideId} v${v}: WAITING_RESPONSE → MATCHED (driver ${event.driverId})`,
    );

    const rideData = await matchingRepository.getRideData(event.rideId);

    await publishRideDriverAccepted({
      rideId: event.rideId,
      driverId: event.driverId,
      passengerId: rideData.passengerId ?? "",
      pickupLat: Number(rideData.pickupLat ?? 0),
      pickupLng: Number(rideData.pickupLng ?? 0),
      dropoffLat: Number(rideData.dropoffLat ?? 0),
      dropoffLng: Number(rideData.dropoffLng ?? 0),
      timestamp: new Date().toISOString(),
    });
  },

  async handleOfferRejected(event: RideOfferRejectedEvent): Promise<void> {
    const result = await offerService.rejectOffer(event.offerId, event.rideId, event.driverId);

    if (!result.success) {
      logger.warn(
        { offerId: event.offerId, driverId: event.driverId, reason: result.reason },
        `Ride ${event.rideId} reject failed`,
      );
      return;
    }

    const v = await getVersion(event.rideId);
    logger.info(`Ride ${event.rideId} v${v}: WAITING_RESPONSE → SEARCHING (rejected)`);

    const rideData = await matchingRepository.getRideData(event.rideId);

    await this.continueMatching(
      event.rideId,
      Number(rideData.pickupLat ?? 0),
      Number(rideData.pickupLng ?? 0),
    );
  },

  async handleOfferExpired(offerId: string, rideId: string, driverId: string): Promise<void> {
    const result = await offerService.expireOffer(offerId, rideId, driverId);

    if (!result.success) return;

    const v = await getVersion(rideId);
    logger.info(`Ride ${rideId} v${v}: WAITING_RESPONSE → SEARCHING (expired)`);

    const rideData = await matchingRepository.getRideData(rideId);

    await publishRideOfferExpired({
      offerId,
      rideId,
      timestamp: new Date().toISOString(),
    });

    await this.continueMatching(
      rideId,
      Number(rideData.pickupLat ?? 0),
      Number(rideData.pickupLng ?? 0),
    );
  },

  async handleRideCancelled(event: RideCancelledEvent): Promise<void> {
    const currentOfferId = await matchingRepository.getMatchingField(
      event.rideId,
      "currentOfferId",
    );
    const currentDriverId = await matchingRepository.getMatchingField(
      event.rideId,
      "currentDriverId",
    );

    if (currentOfferId) {
      timeoutService.cancelTimeout(currentOfferId);
    }

    const finishedAt = new Date().toISOString();

    if (currentOfferId) {
      const cancelResult = await offerService.cancelOffer(currentOfferId, event.rideId, finishedAt);
      if (!cancelResult.success) {
        logger.warn(
          { offerId: currentOfferId, reason: cancelResult.reason },
          `Ride ${event.rideId} cancel failed`,
        );
        return;
      }
    }

    const v = await getVersion(event.rideId);
    logger.info(`Ride ${event.rideId} v${v}: → CANCELLED`);

    await publishRideMatchingCancelled({
      rideId: event.rideId,
      passengerId: event.passengerId,
      driverId: currentDriverId ?? undefined,
      timestamp: finishedAt,
    });
  },

  async continueMatching(rideId: string, pickupLat: number, pickupLng: number): Promise<void> {
    const lock = await rideLock.acquire(rideId);
    if (!lock) return;

    try {
      const matchingState = await matchingRepository.getMatchingField(rideId, "state");
      if (matchingState !== "SEARCHING") return;

      const rideData = await matchingRepository.getRideData(rideId);
      let radius = Number(rideData.radius ?? env.MATCHING_INITIAL_RADIUS);

      while (radius <= env.MATCHING_MAX_RADIUS) {
        const contacted = await matchingRepository.getContactedDrivers(rideId);

        const driver = await h3Service.findNearestDriver({
          latitude: pickupLat,
          longitude: pickupLng,
          radiusMeters: radius,
          excludedDrivers: contacted,
        });

        if (driver) {
          const event: RideRequestedEvent = {
            rideId,
            passengerId: rideData.passengerId ?? "",
            pickupLat,
            pickupLng,
            dropoffLat: Number(rideData.dropoffLat ?? 0),
            dropoffLng: Number(rideData.dropoffLng ?? 0),
            timestamp: new Date().toISOString(),
          };

          await matchingRepository.setMatchingField(rideId, "radius", radius.toString());
          await offerService.createOffer(event, driver, radius);

          const v = await getVersion(rideId);
          logger.info(
            `Ride ${rideId} v${v}: SEARCHING → WAITING_RESPONSE (driver ${driver.driverId}, radius ${radius}m)`,
          );
          return;
        }

        radius *= 2;
      }

      await matchingRepository.setMatchingField(rideId, "state", "NO_DRIVERS");

      const v = await getVersion(rideId);
      logger.info(`Ride ${rideId} v${v}: SEARCHING → NO_DRIVERS`);

      await publishRideNoDrivers({
        rideId,
        passengerId: rideData.passengerId ?? "",
        pickupLat,
        pickupLng,
        timestamp: new Date().toISOString(),
      });
    } finally {
      await rideLock.release(lock);
    }
  },
};
