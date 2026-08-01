export interface ITimeoutService {
  scheduleTimeout(offerId: string, rideId: string): Promise<void>;
  cancelTimeout(offerId: string): void;
  cancelAll(): void;
}
