import { type ConfirmChannel } from "amqplib";
import { getConnection } from "./connection.js";
import { logger } from "../utils/logger.js";

let channel: ConfirmChannel | null = null;

export async function getChannel(): Promise<ConfirmChannel> {
  if (channel) return channel;

  const conn = await getConnection();
  channel = await conn.createConfirmChannel();

  channel.on("close", () => {
    logger.warn("RabbitMQ channel closed");
    channel = null;
  });

  return channel;
}

export async function closeChannel(): Promise<void> {
  if (channel) {
    await channel.close();
    channel = null;
  }
}

export function resetChannel(): void {
  channel = null;
}
