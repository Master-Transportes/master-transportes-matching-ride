import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { assertQueue, consume } from "../infra/rabbitmq/queue.js";
import { QUEUES } from "../config/constants.js";
import type { ConsumerDeps } from "./consumer-deps.js";

const schema = z.object({
  rideId: z.string().uuid(),
  offerId: z.string().uuid(),
  driverId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export async function register(deps: ConsumerDeps): Promise<void> {
  await assertQueue(
    QUEUES.OFFER_ACCEPTED.name,
    QUEUES.OFFER_ACCEPTED.routingKey,
    QUEUES.OFFER_ACCEPTED.name,
  );
  await consume(QUEUES.OFFER_ACCEPTED.name, handleMessage(deps));
}

function handleMessage(deps: ConsumerDeps) {
  return async function (msg: ConsumeMessage): Promise<void> {
    const event = schema.parse(JSON.parse(msg.content.toString()));
    await deps.matchingService.handleOfferAccepted(event);
  };
}
