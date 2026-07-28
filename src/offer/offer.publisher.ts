import { getChannel } from "../rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../rabbitmq/exchange.js";
import { withRetry } from "../utils/retry.js";
import { publishToUser } from "../gateway/publisher.js";
import type { RideNewOfferEvent } from "../domain/types.js";

export const offerPublisher = {
  async publishNewOffer(event: RideNewOfferEvent): Promise<void> {
    await withRetry(async () => {
      const ch = await getChannel();
      ch.publish(EXCHANGE_NAME, "ride.offer.new", Buffer.from(JSON.stringify(event)), {
        persistent: true,
      });
      await ch.waitForConfirms();
    });

    await publishToUser(event.driverId, "ride.new_offer", {
      rideId: event.rideId,
      offerId: event.offerId,
      pickupLat: event.pickupLat,
      pickupLng: event.pickupLng,
      dropoffLat: event.dropoffLat,
      dropoffLng: event.dropoffLng,
      originName: event.originName,
      destinationName: event.destinationName,
      offerExpiresAt: event.offerExpiresAt,
      timestamp: event.timestamp,
    });
  },
};
