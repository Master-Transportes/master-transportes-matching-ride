import http from "http";
import { redis } from "../infra/redis/client.js";
import { getConnection } from "../infra/rabbitmq/connection.js";
import { logger } from "./logger.js";
import { env } from "../config/env.js";

export function startServer(): void {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      handleHealth(res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(env.HTTP_PORT, () => {
    logger.info({ port: env.HTTP_PORT }, "HTTP server listening");
  });
}

async function handleHealth(res: http.ServerResponse): Promise<void> {
  const redisOk = await checkRedis();
  const rabbitOk = await checkRabbit();

  const status = redisOk && rabbitOk ? "ok" : "degraded";

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status, redis: redisOk, rabbitmq: rabbitOk }));
}

async function checkRedis(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

async function checkRabbit(): Promise<boolean> {
  try {
    const conn = await getConnection();
    return conn !== null;
  } catch {
    return false;
  }
}
