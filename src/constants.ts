export const REDIS = {
  MATCHING_PREFIX: "matching:ride",
  RIDE_PREFIX: "ride",
  OFFER_PREFIX: "offer",
  DRIVER_PREFIX: "driver",
  LOCK_PREFIX: "lock:ride",
  DRIVERS_LOCATION: "drivers:location",
  DRIVERS_H3: (cell: string) => `drivers:h3:${cell}`,
  DRIVER: (id: string) => `driver:${id}`,
  OFFER: (id: string) => `offer:${id}`,
  MATCHING: (rideId: string) => `matching:ride:${rideId}`,
  RIDE: (rideId: string) => `ride:${rideId}`,
  CONTACTED: (rideId: string) => `matching:ride:${rideId}:contacted`,
} as const;

export const RABBITMQ = {
  EXCHANGE: "ride.exchange",
  DLX: "ride.timeout.dlx",
  DLQ_EXCHANGE: "ride.dlq",
  GATEWAY_EXCHANGE: "ws.gateway",
  WAIT_QUEUE: "matching.ride.offer.wait",
  TIMEOUT_QUEUE: "matching.ride.offer.timeout",
  WAIT_ROUTING_KEY: "ride.offer.wait",
  TIMEOUT_ROUTING_KEY: "ride.offer.timeout",
} as const;

export const QUEUES = {
  RIDE_REQUESTED: { name: "matching.ride.requested", routingKey: "ride.requested" },
  OFFER_ACCEPTED: { name: "matching.ride.offer.accepted", routingKey: "ride.offer.accepted" },
  OFFER_REJECTED: { name: "matching.ride.offer.rejected", routingKey: "ride.offer.rejected" },
  OFFER_EXPIRED: { name: "matching.ride.offer.expired", routingKey: "ride.offer.expired" },
  RIDE_CANCELLED: { name: "matching.ride.cancelled", routingKey: "ride.cancelled" },
} as const;

export const GATEWAY = {
  EXCHANGE: "ws.gateway",
  ROUTING_KEY: "ws.gateway.user",
} as const;

export const MATCHING = {
  INITIAL_TTL: 3600,
  LOCK_TTL: 10,
  LOCK_RENEWAL_INTERVAL: 5000,
} as const;


