import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  RABBITMQ_URL: z.url(),
  REDIS_URL: z.string().url(),

  H3_RESOLUTION: z.coerce.number().int().positive().default(9),
  MATCHING_INITIAL_RADIUS: z.coerce.number().int().positive().default(1500),
  MATCHING_MAX_RADIUS: z.coerce.number().int().positive().default(15000),
  OFFER_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(20),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_PRETTY: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  HTTP_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  HTTP_PORT: z.coerce.number().int().positive().default(9090),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
