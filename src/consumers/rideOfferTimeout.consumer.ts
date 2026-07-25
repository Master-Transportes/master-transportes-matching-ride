import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { consume } from "../rabbitmq/queue.js";
import { getChannel } from "../rabbitmq/channel.js";
import { matchingService } from "../services/matching.service.js";
import { redis } from "../redis/client.js";
import { REDIS, RABBITMQ } from "../constants.js";

const schema = z.object({
  offerId: z.string().uuid(),
  rideId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export async function register(): Promise<void> {
  const ch = await getChannel();
  await ch.assertQueue(RABBITMQ.TIMEOUT_QUEUE, { durable: true });
  await consume(RABBITMQ.TIMEOUT_QUEUE, handleMessage);
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
