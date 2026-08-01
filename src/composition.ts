import { env } from "./config/env.js";
import { redis, connectRedis } from "./infra/redis/index.js";
import { initRabbitMQ, closeChannel, closeConnection } from "./infra/rabbitmq/index.js";
import { onReconnect } from "./infra/rabbitmq/connection.js";
import { createGatewayPublisher } from "./implementations/publishers/rabbit-gateway.publisher.js";
import { createOfferPublisher } from "./implementations/publishers/rabbit-offer.publisher.js";
import { createRideEventPublisher } from "./implementations/publishers/rabbit-ride-event.publisher.js";
import { createRabbitTimeoutService } from "./implementations/services/rabbit-timeout.service.js";
import { createRedisRideLock } from "./implementations/services/redis-ride-lock.service.js";
import { createRedisMatchingRepository } from "./implementations/repositories/redis-matching.repository.js";
import { createRedisOfferRepository } from "./implementations/repositories/redis-offer.repository.js";
import { createRedisDriverGeoRepository } from "./implementations/repositories/redis-driver-geo.repository.js";
import { startGeoIndexJanitor } from "./implementations/services/geo-index-janitor.service.js";
import { createDriverGeoService } from "./services/driver-geo.service.js";
import { createOfferService } from "./services/offer.service.js";
import { createMatchingService } from "./services/matching.service.js";
import { registerAll } from "./consumers/index.js";
import { startServer } from "./utils/server.js";
import { logger } from "./utils/logger.js";

export function buildApplication() {
  const gatewayPublisher = createGatewayPublisher();
  const offerPublisher = createOfferPublisher(gatewayPublisher);
  const rideEventPublisher = createRideEventPublisher(gatewayPublisher);
  const timeoutService = createRabbitTimeoutService(env);
  const rideLock = createRedisRideLock(redis);
  const matchingRepository = createRedisMatchingRepository(redis, env);
  const offerRepository = createRedisOfferRepository(redis);
  const geoRepository = createRedisDriverGeoRepository(redis);

  const driverGeoService = createDriverGeoService({ env, geoRepository });
  const offerService = createOfferService({ env, offerRepository, offerPublisher, timeoutService });
  const matchingService = createMatchingService({
    env,
    matchingRepository,
    offerService,
    driverGeoService,
    rideLock,
    timeoutService,
    rideEventPublisher,
  });

  const consumerDeps = { matchingService, offerService };

  let geoJanitor: NodeJS.Timeout | undefined;

  return {
    async start(): Promise<void> {
      logger.info("Starting");

      await connectRedis();
      geoJanitor = startGeoIndexJanitor(redis);
      await initRabbitMQ();
      await registerAll(consumerDeps);

      if (env.HTTP_ENABLED) {
        startServer();
      }

      logger.info("Started");
    },

    async reinit(): Promise<void> {
      await initRabbitMQ();
      await registerAll(consumerDeps);
    },

    onReconnect(cb: () => Promise<void>): void {
      onReconnect(cb);
    },

    registerShutdown(): void {
      const shutdown = async () => {
        logger.info("Shutting down gracefully...");
        if (geoJanitor) clearInterval(geoJanitor);
        timeoutService.cancelAll();
        await closeChannel();
        await closeConnection();
        await redis.quit();
        logger.info("Shutdown complete");
        process.exit(0);
      };

      process.on("SIGTERM", shutdown);
      process.on("SIGINT", shutdown);
    },
  };
}
