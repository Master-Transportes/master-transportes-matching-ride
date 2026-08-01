import type { Redis } from "ioredis";
import { DRIVER_KEYS } from "../../config/keys-cache.js";
import type {
  IDriverGeoRepository,
  DriverGeoPosition,
} from "../../contracts/IDriverGeoRepository.js";

export function createRedisDriverGeoRepository(redis: Redis): IDriverGeoRepository {
  return {
    async getCandidatesInCells(cells: string[], excludedDrivers: Set<string>): Promise<string[]> {
      if (cells.length === 0) return [];

      const pipeline = redis.pipeline();
      for (const hex of cells) {
        pipeline.smembers(DRIVER_KEYS.H3_CELL(hex));
      }
      const smResults = await pipeline.exec();
      if (!smResults) return [];

      const candidateIds = new Set<string>();
      for (const result of smResults) {
        if (!result) continue;
        const [, members] = result;
        if (Array.isArray(members)) {
          for (const id of members) {
            if (typeof id === "string" && !excludedDrivers.has(id)) {
              candidateIds.add(id);
            }
          }
        }
      }

      return [...candidateIds];
    },

    async getDriverPositions(ids: string[]): Promise<Array<DriverGeoPosition | null>> {
      if (ids.length === 0) return [];

      const geoPipeline = redis.pipeline();
      for (const id of ids) {
        geoPipeline.geopos(DRIVER_KEYS.LOCATION_SET, id);
      }
      const geoResults = await geoPipeline.exec();
      if (!geoResults) return ids.map(() => null);

      const positions: Array<DriverGeoPosition | null> = [];

      for (let i = 0; i < ids.length; i++) {
        const geoResult = geoResults[i];
        if (!geoResult) {
          positions.push(null);
          continue;
        }
        const [, pos] = geoResult;
        if (!Array.isArray(pos) || !pos[0] || !Array.isArray(pos[0])) {
          positions.push(null);
          continue;
        }

        const [lng, lat] = pos[0];
        if (lat === undefined || lng === undefined) {
          positions.push(null);
          continue;
        }

        const driverId = ids[i];
        if (!driverId) {
          positions.push(null);
          continue;
        }

        const [status, lastLocationUpdate] = (await redis.hmget(
          DRIVER_KEYS.LOCATION(driverId),
          "status",
          "lastLocationUpdate",
        )) as [string | null, string | null];

        positions.push({
          driverId,
          latitude: Number.parseFloat(lat),
          longitude: Number.parseFloat(lng),
          status,
          lastLocationUpdate,
        });
      }

      return positions;
    },
  };
}
