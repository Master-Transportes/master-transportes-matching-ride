import { z } from "zod";
import { type ConsumeMessage } from "amqplib";
import { assertQueue, consume } from "../infra/rabbitmq/queue.js";
import { QUEUES } from "../config/constants.js";
import type { ConsumerDeps } from "./consumer-deps.js";

const schema = z.object({
  rideId: z.string().uuid(),
  passengerId: z.string().uuid(),
  timestamp: z.string(),
});

export async function register(deps: ConsumerDeps): Promise<void> {
  await assertQueue(
    QUEUES.RIDE_CANCELLED.name,
    QUEUES.RIDE_CANCELLED.routingKey,
    QUEUES.RIDE_CANCELLED.name,
  );
  await consume(QUEUES.RIDE_CANCELLED.name, handleMessage(deps));
}

function handleMessage(deps: ConsumerDeps) {
  return async function (msg: ConsumeMessage): Promise<void> {
    const event = schema.parse(JSON.parse(msg.content.toString()));
    await deps.matchingService.handleRideCancelled(event);
  };
}
