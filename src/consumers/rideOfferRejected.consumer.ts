import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { assertQueue, consume } from "../rabbitmq/queue.js";
import { matchingService } from "../services/matching.service.js";
import { QUEUES } from "../constants.js";

const schema = z.object({
  rideId: z.string().uuid(),
  offerId: z.string().uuid(),
  driverId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export async function register(): Promise<void> {
  await assertQueue(
    QUEUES.OFFER_REJECTED.name,
    QUEUES.OFFER_REJECTED.routingKey,
    QUEUES.OFFER_REJECTED.name,
  );
  await consume(QUEUES.OFFER_REJECTED.name, handleMessage);
}

async function handleMessage(msg: ConsumeMessage): Promise<void> {
  const event = schema.parse(JSON.parse(msg.content.toString()));
  await matchingService.handleOfferRejected(event);
}
