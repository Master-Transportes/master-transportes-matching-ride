import "dotenv/config";
import { Redis } from "ioredis";
import { latLngToCell } from "h3-js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const driverId = process.argv[2];
if (!driverId) {
  console.error("Uso: npx tsx scripts/mock-driver.ts <driverId> [lat] [lng]");
  console.error("  Ex: npx tsx scripts/mock-driver.ts 619c3a6c-d989-46ef-a3d7-358288306fe1");
  console.error("  Ex: npx tsx scripts/mock-driver.ts 619c3a6c-d989-46ef-a3d7-358288306fe1 -3.1190 -60.0217");
  process.exit(1);
}

const lat = Number.parseFloat(process.argv[3] ?? "-3.0750");
const lng = Number.parseFloat(process.argv[4] ?? "-60.0900");

const redis = new Redis(REDIS_URL, { lazyConnect: true });

try {
  await redis.connect();

  const h3Resolution = 9;
  const cell = latLngToCell(lat, lng, h3Resolution);

  await redis
    .pipeline()
    .geoadd("drivers:location", lng, lat, driverId)
    .sadd(`drivers:h3:${cell}`, driverId)
    .hset(`driver:${driverId}`, {
      cell,
      status: "available",
      lastLocationUpdate: Date.now().toString(),
    })
    .exec();

  console.log(`Driver indexado com sucesso:`);
  console.log(`  driverId: ${driverId}`);
  console.log(`  lat:      ${lat}`);
  console.log(`  lng:      ${lng}`);
  console.log(`  cell:     ${cell}`);
  console.log(`\nAgora publique um ride.requested nessa região para testar o matching.`);
} finally {
  await redis.quit();
}
