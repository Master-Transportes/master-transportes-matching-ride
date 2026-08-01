import { getChannel } from "../../infra/rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../../infra/rabbitmq/exchange.js";
import { withRetry } from "../../utils/retry.js";
import type { IGatewayPublisher } from "../../contracts/IGatewayPublisher.js";
import type {
  IRideEventPublisher,
  RideOfferExpiredEvent,
} from "../../contracts/IRideEventPublisher.js";
import type {
  RideDriverAcceptedEvent,
  RideNoDriversEvent,
  RideMatchingCancelledEvent,
} from "../../domain/types.js";

export function createRideEventPublisher(gateway: IGatewayPublisher): IRideEventPublisher {
  async function publish(routingKey: string, event: object): Promise<void> {
    await withRetry(async () => {
      const ch = await getChannel();
      ch.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(event)), {
        persistent: true,
      });
      await ch.waitForConfirms();
    });
  }

  return {
    async publishRideNoDrivers(event: RideNoDriversEvent): Promise<void> {
      await publish("ride.no.drivers", event);

      await gateway.publishToUser(event.passengerId, "ride.no_drivers", {
        rideId: event.rideId,
        origin: event.origin,
        timestamp: event.timestamp,
      });
    },

    async publishRideDriverAccepted(event: RideDriverAcceptedEvent): Promise<void> {
      await publish("ride.driver.accepted", event);

      const payload = {
        rideId: event.rideId,
        driverId: event.driverId,
        passengerId: event.passengerId,
        origin: event.origin,
        destination: event.destination,
        timestamp: event.timestamp,
      };

      await gateway.publishToUser(event.driverId, "ride.accepted", payload);
      await gateway.publishToUser(event.passengerId, "ride.accepted", payload);
    },

    async publishRideMatchingCancelled(event: RideMatchingCancelledEvent): Promise<void> {
      await publish("ride.matching.cancelled", event);

      const payload = {
        rideId: event.rideId,
        driverId: event.driverId,
        timestamp: event.timestamp,
      };

      await gateway.publishToUser(event.passengerId, "ride.cancelled", payload);
      if (event.driverId) {
        await gateway.publishToUser(event.driverId, "ride.cancelled", payload);
      }
    },

    async publishRideOfferExpired(event: RideOfferExpiredEvent): Promise<void> {
      await publish("ride.offer.expired", event);
    },
  };
}
