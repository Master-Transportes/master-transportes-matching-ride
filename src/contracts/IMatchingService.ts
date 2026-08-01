import type {
  RideRequestedEvent,
  RideOfferAcceptedEvent,
  RideOfferRejectedEvent,
  RideCancelledEvent,
} from "../domain/types.js";

export interface IMatchingService {
  handleRideRequested(event: RideRequestedEvent): Promise<void>;
  handleOfferAccepted(event: RideOfferAcceptedEvent): Promise<void>;
  handleOfferRejected(event: RideOfferRejectedEvent): Promise<void>;
  handleOfferExpired(offerId: string, rideId: string, driverId: string): Promise<void>;
  handleRideCancelled(event: RideCancelledEvent): Promise<void>;
}
