import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import type { ConsumerDeps } from "./consumer-deps.js";

const schema = z.object({
  offerId: z.string().uuid(),
  rideId: z.string().uuid(),
  timestamp: z.string().datetime().optional(),
});

export function createOfferExpiryHandler(deps: ConsumerDeps) {
  return async function handleMessage(msg: ConsumeMessage): Promise<void> {
    const { offerId, rideId } = schema.parse(JSON.parse(msg.content.toString()));

    const driverId = await deps.offerService.getPendingOfferDriver(offerId);

    if (!driverId) return;

    await deps.matchingService.handleOfferExpired(offerId, rideId, driverId);
  };
}
