import { getChannel } from "../../infra/rabbitmq/channel.js";
import { withRetry } from "../../utils/retry.js";
import { GATEWAY } from "../../config/constants.js";
import type { IGatewayPublisher } from "../../contracts/IGatewayPublisher.js";

export function createGatewayPublisher(): IGatewayPublisher {
  return {
    async publishToUser(
      userId: string,
      event: string,
      payload: Record<string, unknown>,
    ): Promise<void> {
      await withRetry(async () => {
        const ch = await getChannel();
        ch.publish(
          GATEWAY.EXCHANGE,
          GATEWAY.ROUTING_KEY,
          Buffer.from(JSON.stringify({ userId, payload: { event, ...payload } })),
          { persistent: true },
        );
        await ch.waitForConfirms();
      });
    },
  };
}
