import type { RideRequestedEvent, DriverCandidate } from "../domain/types.js";
import type { AcceptOfferResult, CloseOfferResult, CancelOfferResult } from "./IOfferRepository.js";

export interface IOfferService {
  createOffer(event: RideRequestedEvent, driver: DriverCandidate, radius: number): Promise<string>;
  acceptOffer(offerId: string, rideId: string, driverId: string): Promise<AcceptOfferResult>;
  rejectOffer(offerId: string, rideId: string, driverId: string): Promise<CloseOfferResult>;
  expireOffer(offerId: string, rideId: string, driverId: string): Promise<CloseOfferResult>;
  cancelOffer(offerId: string, rideId: string, finishedAt: string): Promise<CancelOfferResult>;
  getPendingOfferDriver(offerId: string): Promise<string | null>;
}
