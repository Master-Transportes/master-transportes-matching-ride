import { getChannel } from "../rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../rabbitmq/exchange.js";
import { withRetry } from "../utils/retry.js";

export async function publishRideOfferExpired(event: {
  offerId: string;
  rideId: string;
  timestamp: string;
}): Promise<void> {
  await withRetry(async () => {
    const ch = await getChannel();
    ch.publish(EXCHANGE_NAME, "ride.offer.expired", Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
    await ch.waitForConfirms();
  });
}
