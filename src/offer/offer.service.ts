import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import { offerRepository } from "./offer.repository.js";
import { offerPublisher } from "./offer.publisher.js";
import { timeoutService } from "../services/timeout.service.js";
import type { RideRequestedEvent, DriverCandidate } from "../domain/types.js";
import type { CancelOfferResult } from "./offer.repository.js";

export const offerService = {
  async createOffer(
    event: RideRequestedEvent,
    driver: DriverCandidate,
    _radius: number,
  ): Promise<string> {
    const offerId = uuidv4();
    const now = Date.now();
    const expiresAt = now + env.OFFER_TIMEOUT_SECONDS * 1000;

    await offerRepository.createOffer(offerId, event.rideId, driver.driverId, now, expiresAt);

    await offerPublisher.publishNewOffer({
      rideId: event.rideId,
      offerId,
      driverId: driver.driverId,
      pickupLat: event.pickupLat,
      pickupLng: event.pickupLng,
      dropoffLat: event.dropoffLat,
      dropoffLng: event.dropoffLng,
      originName: event.originName,
      destinationName: event.destinationName,
      offerExpiresAt: new Date(expiresAt).toISOString(),
      timestamp: new Date().toISOString(),
    });

    await timeoutService.scheduleTimeout(offerId, event.rideId);

    return offerId;
  },

  async acceptOffer(offerId: string, rideId: string, driverId: string) {
    return offerRepository.acceptOffer(offerId, rideId, driverId);
  },

  async rejectOffer(offerId: string, rideId: string, driverId: string) {
    return offerRepository.closeOffer(offerId, rideId, driverId, "rejected");
  },

  async expireOffer(offerId: string, rideId: string, driverId: string) {
    return offerRepository.closeOffer(offerId, rideId, driverId, "expired");
  },

  async cancelOffer(
    offerId: string,
    rideId: string,
    finishedAt: string,
  ): Promise<CancelOfferResult> {
    return offerRepository.cancelOffer(offerId, rideId, finishedAt);
  },
};
