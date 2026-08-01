import type { RideRequestedEvent } from "../domain/types.js";

export interface IMatchingRepository {
  createRideState(event: RideRequestedEvent): Promise<{ created: boolean }>;
  getRideData(rideId: string): Promise<Record<string, string>>;
  getMatchingField(rideId: string, field: string): Promise<string | null>;
  setMatchingField(rideId: string, field: string, value: string): Promise<void>;
  getContactedDrivers(rideId: string): Promise<string[]>;
  /** Reservado: limpeza de estado da corrida em operações de manutenção/auditoria */
  deleteRideState(rideId: string): Promise<void>;
}
