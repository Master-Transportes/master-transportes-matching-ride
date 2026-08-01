export type AcceptOfferResult =
  | { success: true }
  | {
      success: false;
      reason:
        | "OFFER_NOT_PENDING"
        | "DRIVER_MISMATCH"
        | "RIDE_NOT_WAITING"
        | "RIDE_ALREADY_MATCHED"
        | "RIDE_CANCELLED";
    };

export type CloseOfferResult =
  | { success: true }
  | {
      success: false;
      reason: "OFFER_NOT_PENDING" | "DRIVER_MISMATCH" | "RIDE_ALREADY_MATCHED" | "RIDE_CANCELLED";
    };

export type CancelOfferResult =
  { success: true } | { success: false; reason: "RIDE_ALREADY_MATCHED" | "RIDE_NOT_WAITING" };

export interface IOfferRepository {
  createOffer(
    offerId: string,
    rideId: string,
    driverId: string,
    createdAt: number,
    expiresAt: number,
  ): Promise<void>;
  acceptOffer(offerId: string, rideId: string, driverId: string): Promise<AcceptOfferResult>;
  closeOffer(
    offerId: string,
    rideId: string,
    driverId: string,
    newStatus: "rejected" | "expired",
  ): Promise<CloseOfferResult>;
  cancelOffer(offerId: string, rideId: string, finishedAt: string): Promise<CancelOfferResult>;
  /** Reservado: consulta direta de status da oferta (uso futuro/operacional) */
  getOfferStatus(offerId: string): Promise<string | null>;
  getOfferStatusAndDriver(offerId: string): Promise<[string | null, string | null]>;
}
