import { latLngToCell, gridRing } from "h3-js";
import type { Env } from "../config/env.js";
import type { IDriverGeoRepository } from "../contracts/IDriverGeoRepository.js";
import type { IDriverGeoService } from "../contracts/IDriverGeoService.js";
import { haversineDistance } from "../utils/haversine.js";
import { withRetry } from "../utils/retry.js";
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

export interface DriverGeoServiceDeps {
  env: Env;
  geoRepository: IDriverGeoRepository;
}

export function createDriverGeoService(deps: DriverGeoServiceDeps): IDriverGeoService {
  function getEdgeLengthMeters(): number {
    return H3_EDGE_LENGTHS[deps.env.H3_RESOLUTION] ?? 121;
  }

  function radiusToK(radiusMeters: number): number {
    const stepDistance = getEdgeLengthMeters() * Math.sqrt(3);
    return Math.max(1, Math.ceil(radiusMeters / stepDistance));
  }

  async function resolvePositions(
    ids: string[],
    originLat: number,
    originLng: number,
    radiusMeters: number,
    excludedDrivers: Set<string>,
  ): Promise<DriverCandidate | null> {
    if (ids.length === 0) return null;

    const positions = await deps.geoRepository.getDriverPositions(ids);

    const candidates: DriverCandidate[] = [];

    for (const position of positions) {
      if (!position) continue;

      if (excludedDrivers.has(position.driverId)) continue;

      if (!position.status || position.status === "busy" || position.status === "offline") {
        continue;
      }

      const distanceMeters = haversineDistance(
        originLat,
        originLng,
        position.latitude,
        position.longitude,
      );
      if (distanceMeters > radiusMeters) continue;

      candidates.push({
        driverId: position.driverId,
        latitude: position.latitude,
        longitude: position.longitude,
        distanceMeters,
        lastLocationUpdate: Number(position.lastLocationUpdate ?? 0),
      });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return candidates[0] ?? null;
  }

  return {
    async findNearestDriver(params: {
      latitude: number;
      longitude: number;
      radiusMeters: number;
      excludedDrivers?: string[];
    }): Promise<DriverCandidate | null> {
      const originHex = latLngToCell(params.latitude, params.longitude, deps.env.H3_RESOLUTION);
      const maxK = radiusToK(params.radiusMeters);
      const excluded = new Set(params.excludedDrivers ?? []);

      const originCandidates = await withRetry(() =>
        deps.geoRepository.getCandidatesInCells([originHex], excluded),
      );
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

      for (let k = 1; k <= maxK; k++) {
        let cells: string[];
        try {
          cells = gridRing(originHex, k);
        } catch {
          continue;
        }

        const ringCandidates = await withRetry(() =>
          deps.geoRepository.getCandidatesInCells(cells, excluded),
        );
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
}
