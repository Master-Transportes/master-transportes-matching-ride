import { logger } from "../../utils/logger.js";
import { RABBITMQ } from "../../config/constants.js";
import { getConnection } from "./connection.js";
import { getChannel } from "./channel.js";
import { setupExchange, setupDLX, setupDLQ, EXCHANGE_NAME, DLX_NAME } from "./exchange.js";

export { getConnection, closeConnection } from "./connection.js";
export { getChannel, closeChannel } from "./channel.js";
export { setupExchange, DLX_NAME, DLQ_EXCHANGE_NAME } from "./exchange.js";
export { assertQueue, consume } from "./queue.js";

export async function initRabbitMQ(): Promise<void> {
  await getConnection();
  const ch = await getChannel();

  await setupExchange();
  await setupDLX();
  await setupDLQ();

  // Wait queue: per-message TTL via expiration header, dead-letters to DLX
  await ch.assertQueue(RABBITMQ.WAIT_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": DLX_NAME,
      "x-dead-letter-routing-key": RABBITMQ.TIMEOUT_ROUTING_KEY,
    },
  });
  await ch.bindQueue(RABBITMQ.WAIT_QUEUE, EXCHANGE_NAME, RABBITMQ.WAIT_ROUTING_KEY);

  // Timeout queue: receives dead-lettered messages from wait queue
  await ch.assertQueue(RABBITMQ.TIMEOUT_QUEUE, { durable: true });
  await ch.bindQueue(RABBITMQ.TIMEOUT_QUEUE, DLX_NAME, RABBITMQ.TIMEOUT_ROUTING_KEY);

  // WebSocket gateway exchange
  await ch.assertExchange(RABBITMQ.GATEWAY_EXCHANGE, "topic", { durable: true });

  logger.info("RabbitMQ layer initialized");
}
