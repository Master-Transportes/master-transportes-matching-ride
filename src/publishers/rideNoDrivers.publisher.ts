import { getChannel } from "../rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../rabbitmq/exchange.js";
import { withRetry } from "../utils/retry.js";
import { publishToUser } from "../gateway/publisher.js";
import type { RideNoDriversEvent } from "../domain/types.js";

export async function publishRideNoDrivers(event: RideNoDriversEvent): Promise<void> {
  await withRetry(async () => {
    const ch = await getChannel();
    ch.publish(EXCHANGE_NAME, "ride.no.drivers", Buffer.from(JSON.stringify(event)), {
      persistent: true,
    });
    await ch.waitForConfirms();
  });

  await publishToUser(event.passengerId, "ride.no_drivers", {
    rideId: event.rideId,
    pickupLat: event.pickupLat,
    pickupLng: event.pickupLng,
    timestamp: event.timestamp,
  });
}
