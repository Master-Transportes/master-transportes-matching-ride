import { type ConsumeMessage, type Options } from "amqplib";
import { getChannel } from "./channel.js";
import { EXCHANGE_NAME, DLQ_EXCHANGE_NAME } from "./exchange.js";
import { logger } from "../../utils/logger.js";

export async function assertQueue(name: string, routingKey: string, dlq?: string): Promise<void> {
  const ch = await getChannel();

  const args: Options.AssertQueue = { durable: true };

  if (dlq) {
    args.arguments = {
      "x-dead-letter-exchange": DLQ_EXCHANGE_NAME,
      "x-dead-letter-routing-key": dlq,
    };
  }

  await ch.assertQueue(name, args);
  await ch.bindQueue(name, EXCHANGE_NAME, routingKey);
}

export async function consume(
  queue: string,
  handler: (msg: ConsumeMessage) => Promise<void>,
): Promise<void> {
  const ch = await getChannel();
  await ch.prefetch(10);
  await ch.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      await handler(msg);
      ch.ack(msg);
    } catch (err) {
      logger.error({ err, queue }, "Error processing message");
      ch.nack(msg, false, false);
    }
  });
}
