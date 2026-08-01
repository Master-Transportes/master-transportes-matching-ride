export interface RidePoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RideRequestedEvent {
  rideId: string;
  passengerId: string;
  origin: RidePoint;
  destination: RidePoint;
  timestamp: string;
}

export interface RideOfferAcceptedEvent {
  rideId: string;
  offerId: string;
  driverId: string;
  timestamp: string;
}

export interface RideOfferRejectedEvent {
  rideId: string;
  offerId: string;
  driverId: string;
  timestamp: string;
}

export interface RideNewOfferEvent {
  rideId: string;
  offerId: string;
  driverId: string;
  origin: RidePoint;
  destination: RidePoint;
  offerExpiresAt: string;
  timestamp: string;
}

export interface RideDriverAcceptedEvent {
  rideId: string;
  driverId: string;
  passengerId: string;
  origin: RidePoint;
  destination: RidePoint;
  timestamp: string;
}

export interface RideCancelledEvent {
  rideId: string;
  passengerId: string;
  timestamp: string;
}

export interface RideMatchingCancelledEvent {
  rideId: string;
  passengerId: string;
  driverId?: string;
  timestamp: string;
}

export interface RideNoDriversEvent {
  rideId: string;
  passengerId: string;
  origin: RidePoint;
  timestamp: string;
}

export interface DriverCandidate {
  driverId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  lastLocationUpdate: number;
}

export type MatchingState =
  "SEARCHING" | "WAITING_RESPONSE" | "MATCHED" | "NO_DRIVERS" | "CANCELLED";

export interface MatchingRideState {
  state: MatchingState;
  currentOfferId: string;
  currentDriverId: string;
  radius: number;
  version: number;
}

export type OfferStatus = "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export interface OfferData {
  rideId: string;
  driverId: string;
  status: OfferStatus;
  createdAt: string;
  expiresAt: string;
}
