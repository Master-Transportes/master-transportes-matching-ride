import { assertQueue, consume } from "../infra/rabbitmq/queue.js";
import { QUEUES } from "../config/constants.js";
import { createOfferExpiryHandler } from "./offer-expiry.handler.js";
import type { ConsumerDeps } from "./consumer-deps.js";

export async function register(deps: ConsumerDeps): Promise<void> {
  await assertQueue(
    QUEUES.OFFER_EXPIRED.name,
    QUEUES.OFFER_EXPIRED.routingKey,
    QUEUES.OFFER_EXPIRED.name,
  );
  await consume(QUEUES.OFFER_EXPIRED.name, createOfferExpiryHandler(deps));
}
