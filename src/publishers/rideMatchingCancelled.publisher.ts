import { getChannel } from "../rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../rabbitmq/exchange.js";
import { withRetry } from "../utils/retry.js";
import { publishToUser } from "../gateway/publisher.js";

export async function publishRideMatchingCancelled(event: {
  rideId: string;
  passengerId: string;
  driverId?: string;
  timestamp: string;
}): Promise<void> {
  await withRetry(async () => {
    const ch = await getChannel();
    ch.publish(EXCHANGE_NAME, "ride.matching.cancelled", Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
    await ch.waitForConfirms();
  });

  const payload = {
    rideId: event.rideId,
    driverId: event.driverId,
    timestamp: event.timestamp,
  };

  await publishToUser(event.passengerId, "ride.cancelled", payload);
  if (event.driverId) {
    await publishToUser(event.driverId, "ride.cancelled", payload);
  }
}
