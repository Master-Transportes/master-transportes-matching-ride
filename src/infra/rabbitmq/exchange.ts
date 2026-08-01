import { getChannel } from "./channel.js";
import { RABBITMQ } from "../../config/constants.js";

export const EXCHANGE_NAME = RABBITMQ.EXCHANGE;
export const EXCHANGE_TYPE = "topic";
export const DLX_NAME = RABBITMQ.DLX;
export const DLQ_EXCHANGE_NAME = RABBITMQ.DLQ_EXCHANGE;

export async function setupExchange(): Promise<void> {
  const ch = await getChannel();
  await ch.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });
}

export async function setupDLX(): Promise<void> {
  const ch = await getChannel();
  await ch.assertExchange(DLX_NAME, "topic", { durable: true });
}

export async function setupDLQ(): Promise<void> {
  const ch = await getChannel();
  await ch.assertExchange(DLQ_EXCHANGE_NAME, "topic", { durable: true });
}
