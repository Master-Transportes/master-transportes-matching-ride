import type { RideNewOfferEvent } from "../domain/types.js";

export interface IOfferPublisher {
  publishNewOffer(event: RideNewOfferEvent): Promise<void>;
}
