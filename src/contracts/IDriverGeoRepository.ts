export interface DriverGeoPosition {
  driverId: string;
  latitude: number;
  longitude: number;
  status: string | null;
  lastLocationUpdate: string | null;
}

export interface IDriverGeoRepository {
  getCandidatesInCells(cells: string[], excludedDrivers: Set<string>): Promise<string[]>;
  getDriverPositions(ids: string[]): Promise<Array<DriverGeoPosition | null>>;
}
