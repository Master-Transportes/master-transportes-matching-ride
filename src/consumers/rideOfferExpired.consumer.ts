import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { assertQueue, consume } from "../rabbitmq/queue.js";
import { matchingService } from "../services/matching.service.js";
import { redis } from "../redis/client.js";
import { REDIS, QUEUES } from "../constants.js";

const schema = z.object({
  offerId: z.string().uuid(),
  rideId: z.string().uuid(),
  timestamp: z.string().optional(),
});

export async function register(): Promise<void> {
  await assertQueue(
    QUEUES.OFFER_EXPIRED.name,
    QUEUES.OFFER_EXPIRED.routingKey,
    QUEUES.OFFER_EXPIRED.name,
  );
  await consume(QUEUES.OFFER_EXPIRED.name, handleMessage);
}

async function handleMessage(msg: ConsumeMessage): Promise<void> {
  const { offerId, rideId } = schema.parse(JSON.parse(msg.content.toString()));

  const [status, driverId] = (await redis.hmget(REDIS.OFFER(offerId), "status", "driverId")) as [
    string | null,
    string | null,
  ];

  if (status !== "pending" || !driverId) return;

  await matchingService.handleOfferExpired(offerId, rideId, driverId);
}
