import { getChannel } from "../../infra/rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../../infra/rabbitmq/exchange.js";
import { withRetry } from "../../utils/retry.js";
import type { IGatewayPublisher } from "../../contracts/IGatewayPublisher.js";
import type { IOfferPublisher } from "../../contracts/IOfferPublisher.js";
import type { RideNewOfferEvent } from "../../domain/types.js";

export function createOfferPublisher(gateway: IGatewayPublisher): IOfferPublisher {
  return {
    async publishNewOffer(event: RideNewOfferEvent): Promise<void> {
      await withRetry(async () => {
        const ch = await getChannel();
        ch.publish(EXCHANGE_NAME, "ride.offer.new", Buffer.from(JSON.stringify(event)), {
          persistent: true,
        });
        await ch.waitForConfirms();
      });

      await gateway.publishToUser(event.driverId, "ride.new_offer", {
        rideId: event.rideId,
        offerId: event.offerId,
        origin: event.origin,
        destination: event.destination,
        offerExpiresAt: event.offerExpiresAt,
        timestamp: event.timestamp,
      });
    },
  };
}
