export const CREATE_RIDE_LUA = `
  local exists = redis.call("EXISTS", KEYS[2])
  if exists == 1 then
    return { 0, "ALREADY_EXISTS" }
  end

  redis.call("HSET", KEYS[1],
    "passengerId", ARGV[1],
    "pickupLat", ARGV[2],
    "pickupLng", ARGV[3],
    "dropoffLat", ARGV[4],
    "dropoffLng", ARGV[5]
  )
  redis.call("EXPIRE", KEYS[1], ARGV[7])

  redis.call("HSET", KEYS[2],
    "state", "SEARCHING",
    "radius", ARGV[6],
    "version", "1"
  )
  redis.call("EXPIRE", KEYS[2], ARGV[7])

  return { 1, "CREATED" }
`;
