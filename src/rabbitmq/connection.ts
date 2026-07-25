import { connect, type ChannelModel } from "amqplib";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { resetChannel } from "./channel.js";

let connection: ChannelModel | null = null;
let connecting = false;

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let reconnectCallback: (() => Promise<void>) | null = null;

const MAX_RECONNECT_DELAY = 30_000;

export function onReconnect(cb: () => Promise<void>): void {
  reconnectCallback = cb;
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  connecting = true;
  const delay = Math.min(1_000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY);
  reconnectAttempt++;
  logger.warn(`Scheduling RabbitMQ reconnect in ${delay}ms (attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    // getConnection() already established a connection
    if (connection) {
      connecting = false;
      return;
    }
    try {
      const conn = await connect(env.RABBITMQ_URL);
      connection = conn;
      reconnectAttempt = 0;
      connecting = false;

      conn.on("close", () => {
        logger.warn("RabbitMQ connection closed");
        connection = null;
        connecting = false;
        resetChannel();
        scheduleReconnect();
      });

      conn.on("error", (err) => {
        logger.error({ err }, "RabbitMQ connection error");
      });

      logger.info("RabbitMQ reconnected");
      if (reconnectCallback) {
        await reconnectCallback();
      }
    } catch (err) {
      connecting = false;
      logger.error({ err }, "RabbitMQ reconnect failed");
      scheduleReconnect();
    }
  }, delay);
}

export async function getConnection(): Promise<ChannelModel> {
  if (connection) return connection;

  if (connecting) {
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (connection || !connecting) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
    if (connection) return connection;
  }

  connecting = true;
  try {
    connection = await connect(env.RABBITMQ_URL);

    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed");
      connection = null;
      connecting = false;
      resetChannel();
      scheduleReconnect();
    });

    connection.on("error", (err) => {
      logger.error({ err }, "RabbitMQ connection error");
    });

    logger.info("RabbitMQ connected");
    connecting = false;
    return connection;
  } catch (err) {
    connecting = false;
    logger.error({ err }, "Failed to connect to RabbitMQ");
    throw err;
  }
}

export async function closeConnection(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    connecting = false;
  }
  if (connection) {
    await connection.close();
    connection = null;
  }
}
