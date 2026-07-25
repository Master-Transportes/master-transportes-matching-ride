import { latLngToCell, gridRing } from "h3-js";
import { env } from "../config/env.js";
import { redis } from "../redis/client.js";
import { haversineDistance } from "../utils/haversine.js";
import { withRetry } from "../utils/retry.js";
import { REDIS } from "../constants.js";
import type { DriverCandidate } from "../domain/types.js";

const H3_EDGE_LENGTHS: Record<number, number> = {
  0: 1107742,
  1: 410345,
  2: 148509,
  3: 53755,
  4: 19458,
  5: 7043,
  6: 2550,
  7: 923,
  8: 334,
  9: 121,
  10: 44,
  11: 16,
  12: 6,
  13: 2,
  14: 0.8,
  15: 0.3,
};

function getEdgeLengthMeters(): number {
  return H3_EDGE_LENGTHS[env.H3_RESOLUTION] ?? 121;
}

function radiusToK(radiusMeters: number): number {
  const stepDistance = getEdgeLengthMeters() * Math.sqrt(3);
  return Math.max(1, Math.ceil(radiusMeters / stepDistance));
}

async function getCandidatesInCells(
  cells: string[],
  excludedDrivers: Set<string>,
): Promise<string[]> {
  if (cells.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const hex of cells) {
    pipeline.smembers(REDIS.DRIVERS_H3(hex));
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
}

async function resolvePositions(
  ids: string[],
  pickupLat: number,
  pickupLng: number,
  radiusMeters: number,
  excludedDrivers: Set<string>,
): Promise<DriverCandidate | null> {
  if (ids.length === 0) return null;

  const geoPipeline = redis.pipeline();
  for (const id of ids) {
    geoPipeline.geopos(REDIS.DRIVERS_LOCATION, id);
  }
  const geoResults = await geoPipeline.exec();
  if (!geoResults) return null;

  const candidates: DriverCandidate[] = [];

  for (let i = 0; i < ids.length; i++) {
    const geoResult = geoResults[i];
    if (!geoResult) continue;
    const [, pos] = geoResult;
    if (!Array.isArray(pos) || !pos[0] || !Array.isArray(pos[0])) continue;

    const [lng, lat] = pos[0];
    if (lat === undefined || lng === undefined) continue;

    const driverId = ids[i];
    if (!driverId || excludedDrivers.has(driverId)) continue;

    const [status, lastLocationUpdate] = (await redis.hmget(
      REDIS.DRIVER(driverId),
      "status",
      "lastLocationUpdate",
    )) as [string | null, string | null];

    if (status === "busy" || status === "offline") continue;

    const distanceMeters = haversineDistance(
      pickupLat,
      pickupLng,
      Number.parseFloat(lat),
      Number.parseFloat(lng),
    );
    if (distanceMeters > radiusMeters) continue;

    candidates.push({
      driverId,
      latitude: Number.parseFloat(lat),
      longitude: Number.parseFloat(lng),
      distanceMeters,
      lastLocationUpdate: Number(lastLocationUpdate ?? 0),
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return candidates[0] ?? null;
}

export const h3Service = {
  async indexDriver(driverId: string, latitude: number, longitude: number): Promise<void> {
    const cell = latLngToCell(latitude, longitude, env.H3_RESOLUTION);

    await redis
      .pipeline()
      .geoadd(REDIS.DRIVERS_LOCATION, longitude, latitude, driverId)
      .sadd(REDIS.DRIVERS_H3(cell), driverId)
      .hset(REDIS.DRIVER(driverId), {
        cell,
        status: "available",
        lastLocationUpdate: Date.now().toString(),
      })
      .exec();
  },

  async updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<void> {
    const newCell = latLngToCell(latitude, longitude, env.H3_RESOLUTION);
    const oldCell = await redis.hget(REDIS.DRIVER(driverId), "cell");

    const pipeline = redis.pipeline();

    pipeline.geoadd(REDIS.DRIVERS_LOCATION, longitude, latitude, driverId);
    pipeline.hset(REDIS.DRIVER(driverId), {
      cell: newCell,
      lastLocationUpdate: Date.now().toString(),
    });

    if (oldCell && oldCell !== newCell) {
      pipeline.srem(REDIS.DRIVERS_H3(oldCell), driverId);
    }
    if (!oldCell || oldCell !== newCell) {
      pipeline.sadd(REDIS.DRIVERS_H3(newCell), driverId);
    }
    if (!oldCell || oldCell !== newCell) {
      pipeline.sadd(`drivers:h3:${newCell}`, driverId);
    }

    await pipeline.exec();
  },

  async removeDriver(driverId: string): Promise<void> {
    const cell = await redis.hget(REDIS.DRIVER(driverId), "cell");

    const pipeline = redis.pipeline();

    pipeline.zrem(REDIS.DRIVERS_LOCATION, driverId);
    if (cell) {
      pipeline.srem(REDIS.DRIVERS_H3(cell), driverId);
    }
    pipeline.hset(REDIS.DRIVER(driverId), "status", "offline");

    await pipeline.exec();
  },

  async getDriverCell(driverId: string): Promise<string | null> {
    return redis.hget(REDIS.DRIVER(driverId), "cell");
  },

  async isDriverIndexed(driverId: string): Promise<boolean> {
    const status = await redis.hget(REDIS.DRIVER(driverId), "status");
    return status !== null && status !== "offline";
  },

  async findNearestDriver(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    excludedDrivers?: string[];
  }): Promise<DriverCandidate | null> {
    const originHex = latLngToCell(params.latitude, params.longitude, env.H3_RESOLUTION);
    const maxK = radiusToK(params.radiusMeters);
    const excluded = new Set(params.excludedDrivers ?? []);

    // Check origin cell first (ring 0)
    const originCandidates = await withRetry(() => getCandidatesInCells([originHex], excluded));
    if (originCandidates.length > 0) {
      const result = await withRetry(() =>
        resolvePositions(
          originCandidates,
          params.latitude,
          params.longitude,
          params.radiusMeters,
          excluded,
        ),
      );
      if (result) return result;
    }

    // Expand outward ring by ring
    for (let k = 1; k <= maxK; k++) {
      let cells: string[];
      try {
        cells = gridRing(originHex, k);
      } catch {
        continue;
      }

      const ringCandidates = await withRetry(() => getCandidatesInCells(cells, excluded));
      if (ringCandidates.length > 0) {
        const result = await withRetry(() =>
          resolvePositions(
            ringCandidates,
            params.latitude,
            params.longitude,
            params.radiusMeters,
            excluded,
          ),
        );
        if (result) return result;
      }
    }

    return null;
  },
};
