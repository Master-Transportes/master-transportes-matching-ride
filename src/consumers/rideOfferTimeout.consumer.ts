import { consume } from "../infra/rabbitmq/queue.js";
import { getChannel } from "../infra/rabbitmq/channel.js";
import { RABBITMQ } from "../config/constants.js";
import { createOfferExpiryHandler } from "./offer-expiry.handler.js";
import type { ConsumerDeps } from "./consumer-deps.js";

export async function register(deps: ConsumerDeps): Promise<void> {
  const ch = await getChannel();
  await ch.assertQueue(RABBITMQ.TIMEOUT_QUEUE, { durable: true });
  await consume(RABBITMQ.TIMEOUT_QUEUE, createOfferExpiryHandler(deps));
}
