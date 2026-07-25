import { initRabbitMQ } from "./rabbitmq/index.js";
import { closeChannel } from "./rabbitmq/channel.js";
import { closeConnection, onReconnect } from "./rabbitmq/connection.js";
import { connectRedis, redis } from "./redis/index.js";
import { startServer } from "./utils/server.js";
import { logger } from "./utils/logger.js";
import { env } from "./config/env.js";
import { timeoutService } from "./services/timeout.service.js";
import {
  registerRideRequested,
  registerOfferAccepted,
  registerOfferRejected,
  registerOfferExpired,
  registerOfferTimeout,
  registerRideCancelled,
} from "./consumers/index.js";

export async function startApplication() {
  logger.info("Starting");

  await connectRedis();

  await initRabbitMQ();

  await registerRideRequested();
  await registerOfferAccepted();
  await registerOfferRejected();
  await registerOfferExpired();
  await registerOfferTimeout();
  await registerRideCancelled();

  if (env.HTTP_ENABLED) {
    startServer();
  }

  logger.info("Started");

  onReconnect(async () => {
    logger.info("Reconnecting RabbitMQ topology...");
    await initRabbitMQ();
    await registerRideRequested();
    await registerOfferAccepted();
    await registerOfferRejected();
    await registerOfferExpired();
    await registerOfferTimeout();
    await registerRideCancelled();
    logger.info("RabbitMQ topology recovered after reconnect");
  });

  const shutdown = async () => {
    logger.info("Shutting down gracefully...");
    timeoutService.cancelAll();
    await closeChannel();
    await closeConnection();
    await redis.quit();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
