import { getChannel } from "../rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../rabbitmq/exchange.js";
import { withRetry } from "../utils/retry.js";
import { publishToUser } from "../gateway/publisher.js";
import type { RideDriverAcceptedEvent } from "../domain/types.js";

export async function publishRideDriverAccepted(event: RideDriverAcceptedEvent): Promise<void> {
  await withRetry(async () => {
    const ch = await getChannel();
    ch.publish(EXCHANGE_NAME, "ride.driver.accepted", Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
    await ch.waitForConfirms();
  });

  const payload = {
    rideId: event.rideId,
    driverId: event.driverId,
    passengerId: event.passengerId,
    pickupLat: event.pickupLat,
    pickupLng: event.pickupLng,
    dropoffLat: event.dropoffLat,
    dropoffLng: event.dropoffLng,
    timestamp: event.timestamp,
  };

  await publishToUser(event.driverId, "ride.accepted", payload);
  await publishToUser(event.passengerId, "ride.accepted", payload);
}
