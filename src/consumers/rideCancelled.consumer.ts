import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { assertQueue, consume } from "../rabbitmq/queue.js";
import { matchingService } from "../services/matching.service.js";
import { QUEUES } from "../constants.js";

const schema = z.object({
  rideId: z.string().uuid(),
  passengerId: z.string().uuid(),
  timestamp: z.string(),
});

export async function register(): Promise<void> {
  await assertQueue(
    QUEUES.RIDE_CANCELLED.name,
    QUEUES.RIDE_CANCELLED.routingKey,
    QUEUES.RIDE_CANCELLED.name,
  );
  await consume(QUEUES.RIDE_CANCELLED.name, handleMessage);
}

async function handleMessage(msg: ConsumeMessage): Promise<void> {
  const event = schema.parse(JSON.parse(msg.content.toString()));
  await matchingService.handleRideCancelled(event);
}
