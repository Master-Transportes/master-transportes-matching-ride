import type {
  RideDriverAcceptedEvent,
  RideNoDriversEvent,
  RideMatchingCancelledEvent,
} from "../domain/types.js";

export interface RideOfferExpiredEvent {
  offerId: string;
  rideId: string;
  timestamp: string;
}

export interface IRideEventPublisher {
  publishRideNoDrivers(event: RideNoDriversEvent): Promise<void>;
  publishRideDriverAccepted(event: RideDriverAcceptedEvent): Promise<void>;
  publishRideMatchingCancelled(event: RideMatchingCancelledEvent): Promise<void>;
  publishRideOfferExpired(event: RideOfferExpiredEvent): Promise<void>;
}
