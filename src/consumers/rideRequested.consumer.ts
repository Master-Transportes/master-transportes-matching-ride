import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { assertQueue, consume } from "../rabbitmq/queue.js";
import { matchingService } from "../services/matching.service.js";
import { QUEUES } from "../constants.js";

const schema = z.object({
  rideId: z.string().uuid(),
  passengerId: z.string().uuid(),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  originName: z.string().min(1),
  destinationName: z.string().min(1),
  timestamp: z.string().datetime(),
});

export async function register(): Promise<void> {
  await assertQueue(
    QUEUES.RIDE_REQUESTED.name,
    QUEUES.RIDE_REQUESTED.routingKey,
    QUEUES.RIDE_REQUESTED.name,
  );
  await consume(QUEUES.RIDE_REQUESTED.name, handleMessage);
}

async function handleMessage(msg: ConsumeMessage): Promise<void> {
  const event = schema.parse(JSON.parse(msg.content.toString()));
  await matchingService.handleRideRequested(event);
}
