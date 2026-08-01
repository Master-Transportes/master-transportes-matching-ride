export const RIDE_KEYS = {
  /** Dados básicos da corrida (recebidos do evento ride.requested) */
  RIDE: (rideId: string) => `ride:${rideId}`,
  /** Estado da máquina de matching (hash) */
  MATCHING_STATE: (rideId: string) => `matching:ride:${rideId}`,
  /** Conjunto de motoristas já contactados para esta corrida */
  CONTACTED_DRIVERS: (rideId: string) => `matching:ride:${rideId}:contacted`,
} as const;

export const OFFER_KEYS = {
  /** Dados da oferta (hash com TTL) */
  OFFER: (offerId: string) => `offer:${offerId}`,
} as const;

export const DRIVER_KEYS = {
  /** Geo set com localização de todos os motoristas disponíveis */
  LOCATION_SET: "drivers:location",
  /** Índice H3: set de motoristas em uma célula */
  H3_CELL: (cell: string) => `drivers:h3:${cell}`,
  /** Perfil do motorista (hash, TTL curto) */
  PROFILE: (driverId: string) => `driver:${driverId}`,
  /** Localização individual do motorista (usado pelo serviço de localização) */
  LOCATION: (driverId: string) => `driver:${driverId}:location`,
} as const;

export const LOCK_KEYS = {
  /** Lock distribuído por corrida (string SET NX EX) */
  RIDE_LOCK: (rideId: string) => `lock:ride:${rideId}`,
} as const;
