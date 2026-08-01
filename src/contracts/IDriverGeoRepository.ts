export interface DriverGeoPosition {
  driverId: string;
  latitude: number;
  longitude: number;
  status: string | null;
  lastLocationUpdate: string | null;
}

export interface IDriverGeoRepository {
  /** Reservado: indexação de novos motoristas (chamado por serviço de localização externo) */
  indexDriver(driverId: string, latitude: number, longitude: number): Promise<void>;
  /** Reservado: atualização de posição em tempo real */
  updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<void>;
  /** Reservado: remoção de motorista offline do índice */
  removeDriver(driverId: string): Promise<void>;
  /** Reservado: consulta da célula H3 atual do motorista */
  getDriverCell(driverId: string): Promise<string | null>;
  /** Reservado: verificação de existência do motorista no índice */
  isDriverIndexed(driverId: string): Promise<boolean>;
  getCandidatesInCells(cells: string[], excludedDrivers: Set<string>): Promise<string[]>;
  getDriverPositions(ids: string[]): Promise<Array<DriverGeoPosition | null>>;
}
