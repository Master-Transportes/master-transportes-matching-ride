import type { DriverCandidate } from "../domain/types.js";

export interface IDriverGeoService {
  findNearestDriver(params: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    excludedDrivers?: string[];
  }): Promise<DriverCandidate | null>;
}
