import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { assertQueue, consume } from "../infra/rabbitmq/queue.js";
import { QUEUES } from "../config/constants.js";
import type { ConsumerDeps } from "./consumer-deps.js";

const schema = z.object({
  rideId: z.string().uuid(),
  passengerId: z.string().uuid(),
  origin: z.object({
    name: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  destination: z.object({
    name: z.string().min(1),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  timestamp: z.string().datetime(),
});

export async function register(deps: ConsumerDeps): Promise<void> {
  await assertQueue(
    QUEUES.RIDE_REQUESTED.name,
    QUEUES.RIDE_REQUESTED.routingKey,
    QUEUES.RIDE_REQUESTED.name,
  );
  await consume(QUEUES.RIDE_REQUESTED.name, handleMessage(deps));
}

function handleMessage(deps: ConsumerDeps) {
  return async function (msg: ConsumeMessage): Promise<void> {
    const event = schema.parse(JSON.parse(msg.content.toString()));
    await deps.matchingService.handleRideRequested(event);
  };
}
