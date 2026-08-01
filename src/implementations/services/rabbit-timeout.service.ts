import { getChannel } from "../../infra/rabbitmq/channel.js";
import { EXCHANGE_NAME } from "../../infra/rabbitmq/exchange.js";
import { RABBITMQ } from "../../config/constants.js";
import type { Env } from "../../config/env.js";
import type { ITimeoutService } from "../../contracts/ITimeoutService.js";

export function createRabbitTimeoutService(env: Env): ITimeoutService {
  return {
    async scheduleTimeout(offerId: string, rideId: string): Promise<void> {
      const ch = await getChannel();
      ch.publish(
        EXCHANGE_NAME,
        RABBITMQ.WAIT_ROUTING_KEY,
        Buffer.from(JSON.stringify({ offerId, rideId, timestamp: new Date().toISOString() })),
        {
          persistent: true,
          expiration: String(env.OFFER_TIMEOUT_SECONDS * 1000),
        },
      );
      await ch.waitForConfirms();
    },

    cancelTimeout(_offerId: string): void {
      // no-op: RabbitMQ não remove mensagens.
      // O consumer valida o status no Redis antes de expirar.
    },

    cancelAll(): void {
      // no-op: timeouts são gerenciados pelo RabbitMQ.
    },
  };
}
