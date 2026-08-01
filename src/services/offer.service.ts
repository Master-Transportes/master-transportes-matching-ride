import { v4 as uuidv4 } from "uuid";
import type { Env } from "../config/env.js";
import type { IOfferRepository } from "../contracts/IOfferRepository.js";
import type { IOfferPublisher } from "../contracts/IOfferPublisher.js";
import type { ITimeoutService } from "../contracts/ITimeoutService.js";
import type { IOfferService } from "../contracts/IOfferService.js";
import type { RideRequestedEvent, DriverCandidate } from "../domain/types.js";

export interface OfferServiceDeps {
  env: Env;
  offerRepository: IOfferRepository;
  offerPublisher: IOfferPublisher;
  timeoutService: ITimeoutService;
}

export function createOfferService(deps: OfferServiceDeps): IOfferService {
  return {
    async createOffer(
      event: RideRequestedEvent,
      driver: DriverCandidate,
      _radius: number,
    ): Promise<string> {
      const offerId = uuidv4();
      const now = Date.now();
      const expiresAt = now + deps.env.OFFER_TIMEOUT_SECONDS * 1000;

      await deps.offerRepository.createOffer(
        offerId,
        event.rideId,
        driver.driverId,
        now,
        expiresAt,
      );

      await deps.offerPublisher.publishNewOffer({
        rideId: event.rideId,
        offerId,
        driverId: driver.driverId,
        origin: event.origin,
        destination: event.destination,
        offerExpiresAt: new Date(expiresAt).toISOString(),
        timestamp: new Date().toISOString(),
      });

      await deps.timeoutService.scheduleTimeout(offerId, event.rideId);

      return offerId;
    },

    async acceptOffer(offerId: string, rideId: string, driverId: string) {
      return deps.offerRepository.acceptOffer(offerId, rideId, driverId);
    },

    async rejectOffer(offerId: string, rideId: string, driverId: string) {
      return deps.offerRepository.closeOffer(offerId, rideId, driverId, "rejected");
    },

    async expireOffer(offerId: string, rideId: string, driverId: string) {
      return deps.offerRepository.closeOffer(offerId, rideId, driverId, "expired");
    },

    async cancelOffer(offerId: string, rideId: string, finishedAt: string) {
      return deps.offerRepository.cancelOffer(offerId, rideId, finishedAt);
    },

    async getPendingOfferDriver(offerId: string): Promise<string | null> {
      const [status, driverId] = await deps.offerRepository.getOfferStatusAndDriver(offerId);
      if (status !== "pending" || !driverId) return null;
      return driverId;
    },
  };
}
