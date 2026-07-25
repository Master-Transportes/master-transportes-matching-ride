import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  name: "matching-service",
  level: env.LOG_LEVEL,
  transport:
    process.env.NODE_ENV === "development" || env.LOG_PRETTY
      ? { target: "pino-pretty" }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
});
