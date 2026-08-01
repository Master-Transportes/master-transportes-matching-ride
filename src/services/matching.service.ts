import type { Env } from "../config/env.js";
import type { IMatchingRepository } from "../contracts/IMatchingRepository.js";
import type { IOfferService } from "../contracts/IOfferService.js";
import type { IDriverGeoService } from "../contracts/IDriverGeoService.js";
import type { IRideLock } from "../contracts/IRideLock.js";
import type { ITimeoutService } from "../contracts/ITimeoutService.js";
import type { IRideEventPublisher } from "../contracts/IRideEventPublisher.js";
import type { IMatchingService } from "../contracts/IMatchingService.js";
import { logger } from "../utils/logger.js";
import type {
  RideRequestedEvent,
  RideOfferAcceptedEvent,
  RideOfferRejectedEvent,
  RideCancelledEvent,
} from "../domain/types.js";

export interface MatchingServiceDeps {
  env: Env;
  matchingRepository: IMatchingRepository;
  offerService: IOfferService;
  driverGeoService: IDriverGeoService;
  rideLock: IRideLock;
  timeoutService: ITimeoutService;
  rideEventPublisher: IRideEventPublisher;
}

async function getVersion(
  matchingRepository: IMatchingRepository,
  rideId: string,
): Promise<number> {
  const v = await matchingRepository.getMatchingField(rideId, "version");
  return Number(v ?? 0);
}

export function createMatchingService(deps: MatchingServiceDeps): IMatchingService {
  async function continueMatching(
    rideId: string,
    originLat: number,
    originLng: number,
  ): Promise<void> {
    const lock = await deps.rideLock.acquire(rideId);
    if (!lock) return;

    try {
      const matchingState = await deps.matchingRepository.getMatchingField(rideId, "state");
      if (matchingState !== "SEARCHING") return;

      const rideData = await deps.matchingRepository.getRideData(rideId);
      let radius = Number(rideData.radius ?? deps.env.MATCHING_INITIAL_RADIUS);

      while (radius <= deps.env.MATCHING_MAX_RADIUS) {
        const contacted = await deps.matchingRepository.getContactedDrivers(rideId);

        const driver = await deps.driverGeoService.findNearestDriver({
          latitude: originLat,
          longitude: originLng,
          radiusMeters: radius,
          excludedDrivers: contacted,
        });

        if (driver) {
          const event: RideRequestedEvent = {
            rideId,
            passengerId: rideData.passengerId ?? "",
            origin: {
              name: rideData.originName ?? "",
              lat: originLat,
              lng: originLng,
            },
            destination: {
              name: rideData.destinationName ?? "",
              lat: Number(rideData.destinationLat ?? 0),
              lng: Number(rideData.destinationLng ?? 0),
            },
            timestamp: new Date().toISOString(),
          };

          await deps.matchingRepository.setMatchingField(rideId, "radius", radius.toString());
          await deps.offerService.createOffer(event, driver, radius);

          const v = await getVersion(deps.matchingRepository, rideId);
          logger.info(
            `Ride ${rideId} v${v}: SEARCHING → WAITING_RESPONSE (driver ${driver.driverId}, radius ${radius}m)`,
          );
          return;
        }

        radius *= 2;
      }

      await deps.matchingRepository.setMatchingField(rideId, "state", "NO_DRIVERS");

      const v = await getVersion(deps.matchingRepository, rideId);
      logger.info(`Ride ${rideId} v${v}: SEARCHING → NO_DRIVERS`);

      await deps.rideEventPublisher.publishRideNoDrivers({
        rideId,
        passengerId: rideData.passengerId ?? "",
        origin: {
          name: rideData.originName ?? "",
          lat: originLat,
          lng: originLng,
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      await deps.rideLock.release(lock);
    }
  }

  return {
    async handleRideRequested(event: RideRequestedEvent): Promise<void> {
      const { created } = await deps.matchingRepository.createRideState(event);

      if (!created) {
        logger.warn(`Ride ${event.rideId} already exists — ignoring duplicate ride.requested`);
        return;
      }

      logger.info(`Ride ${event.rideId} v1: → SEARCHING`);

      await continueMatching(event.rideId, event.origin.lat, event.origin.lng);
    },

    async handleOfferAccepted(event: RideOfferAcceptedEvent): Promise<void> {
      const result = await deps.offerService.acceptOffer(
        event.offerId,
        event.rideId,
        event.driverId,
      );

      if (!result.success) {
        logger.warn(
          { offerId: event.offerId, driverId: event.driverId, reason: result.reason },
          `Ride ${event.rideId} accept failed`,
        );
        return;
      }

      const v = await getVersion(deps.matchingRepository, event.rideId);
      logger.info(
        `Ride ${event.rideId} v${v}: WAITING_RESPONSE → MATCHED (driver ${event.driverId})`,
      );

      const rideData = await deps.matchingRepository.getRideData(event.rideId);

      await deps.rideEventPublisher.publishRideDriverAccepted({
        rideId: event.rideId,
        driverId: event.driverId,
        passengerId: rideData.passengerId ?? "",
        origin: {
          name: rideData.originName ?? "",
          lat: Number(rideData.originLat ?? 0),
          lng: Number(rideData.originLng ?? 0),
        },
        destination: {
          name: rideData.destinationName ?? "",
          lat: Number(rideData.destinationLat ?? 0),
          lng: Number(rideData.destinationLng ?? 0),
        },
        timestamp: new Date().toISOString(),
      });
    },

    async handleOfferRejected(event: RideOfferRejectedEvent): Promise<void> {
      const result = await deps.offerService.rejectOffer(
        event.offerId,
        event.rideId,
        event.driverId,
      );

      if (!result.success) {
        logger.warn(
          { offerId: event.offerId, driverId: event.driverId, reason: result.reason },
          `Ride ${event.rideId} reject failed`,
        );
        return;
      }

      const v = await getVersion(deps.matchingRepository, event.rideId);
      logger.info(`Ride ${event.rideId} v${v}: WAITING_RESPONSE → SEARCHING (rejected)`);

      const rideData = await deps.matchingRepository.getRideData(event.rideId);

      await continueMatching(
        event.rideId,
        Number(rideData.originLat ?? 0),
        Number(rideData.originLng ?? 0),
      );
    },

    async handleOfferExpired(offerId: string, rideId: string, driverId: string): Promise<void> {
      const result = await deps.offerService.expireOffer(offerId, rideId, driverId);

      if (!result.success) return;

      const v = await getVersion(deps.matchingRepository, rideId);
      logger.info(`Ride ${rideId} v${v}: WAITING_RESPONSE → SEARCHING (expired)`);

      const rideData = await deps.matchingRepository.getRideData(rideId);

      await deps.rideEventPublisher.publishRideOfferExpired({
        offerId,
        rideId,
        timestamp: new Date().toISOString(),
      });

      await continueMatching(
        rideId,
        Number(rideData.originLat ?? 0),
        Number(rideData.originLng ?? 0),
      );
    },

    async handleRideCancelled(event: RideCancelledEvent): Promise<void> {
      const currentOfferId = await deps.matchingRepository.getMatchingField(
        event.rideId,
        "currentOfferId",
      );
      const currentDriverId = await deps.matchingRepository.getMatchingField(
        event.rideId,
        "currentDriverId",
      );

      if (currentOfferId) {
        deps.timeoutService.cancelTimeout(currentOfferId);
      }

      const finishedAt = new Date().toISOString();

      if (currentOfferId) {
        const cancelResult = await deps.offerService.cancelOffer(
          currentOfferId,
          event.rideId,
          finishedAt,
        );
        if (!cancelResult.success) {
          logger.warn(
            { offerId: currentOfferId, reason: cancelResult.reason },
            `Ride ${event.rideId} cancel failed`,
          );
          return;
        }
      }

      const v = await getVersion(deps.matchingRepository, event.rideId);
      logger.info(`Ride ${event.rideId} v${v}: → CANCELLED`);

      await deps.rideEventPublisher.publishRideMatchingCancelled({
        rideId: event.rideId,
        passengerId: event.passengerId,
        driverId: currentDriverId ?? undefined,
        timestamp: finishedAt,
      });
    },
  };
}
