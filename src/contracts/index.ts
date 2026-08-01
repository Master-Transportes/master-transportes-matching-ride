// Barrel para consumidores externos (não utilizado internamente)
export type { IMatchingRepository } from "./IMatchingRepository.js";
export type { IOfferRepository } from "./IOfferRepository.js";
export type { AcceptOfferResult, CloseOfferResult, CancelOfferResult } from "./IOfferRepository.js";
export type { IDriverGeoRepository, DriverGeoPosition } from "./IDriverGeoRepository.js";
export type { IDriverGeoService } from "./IDriverGeoService.js";
export type { IRideEventPublisher, RideOfferExpiredEvent } from "./IRideEventPublisher.js";
export type { IOfferPublisher } from "./IOfferPublisher.js";
export type { IGatewayPublisher } from "./IGatewayPublisher.js";
export type { ITimeoutService } from "./ITimeoutService.js";
export type { IRideLock, LockHandle } from "./IRideLock.js";
export type { IMatchingService } from "./IMatchingService.js";
export type { IOfferService } from "./IOfferService.js";
