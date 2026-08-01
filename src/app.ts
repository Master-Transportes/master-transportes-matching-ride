import { buildApplication } from "./composition.js";
import { logger } from "./utils/logger.js";

export async function startApplication() {
  const app = buildApplication();

  await app.start();

  app.onReconnect(async () => {
    logger.info("Reconnecting RabbitMQ topology...");
    await app.reinit();
    logger.info("RabbitMQ topology recovered after reconnect");
  });

  app.registerShutdown();
}
