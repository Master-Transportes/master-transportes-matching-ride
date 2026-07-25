import { getChannel } from "../rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../rabbitmq/exchange.js";
import { withRetry } from "../utils/retry.js";
import type { RideNewOfferEvent } from "../domain/types.js";

export async function publishRideNewOffer(event: RideNewOfferEvent): Promise<void> {
  await withRetry(async () => {
    const ch = await getChannel();
    ch.publish(EXCHANGE_NAME, "ride.offer.new", Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
    await ch.waitForConfirms();
  });
}
