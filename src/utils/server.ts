import http from "http";
import { redis } from "../redis/client.js";
import { getConnection } from "../rabbitmq/connection.js";
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
  let redisOk = false;
  let rabbitOk = false;

  try {
    await redis.ping();
    redisOk = true;
  } catch {}

  try {
    const conn = await getConnection();
    if (conn) rabbitOk = true;
  } catch {}

  const status = redisOk && rabbitOk ? "ok" : "degraded";

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status, redis: redisOk, rabbitmq: rabbitOk }));
}
