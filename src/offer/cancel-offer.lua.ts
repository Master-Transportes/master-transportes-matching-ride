export const CANCEL_OFFER_LUA = `
  local matchingState = redis.call("HGET", KEYS[2], "state")

  if matchingState == "MATCHED" then
    return { 0, "RIDE_ALREADY_MATCHED" }
  end
  if matchingState == "NO_DRIVERS" then
    return { 0, "RIDE_NOT_WAITING" }
  end

  local driverId = redis.call("HGET", KEYS[1], "driverId")
  if driverId then
    redis.call("HSET", "driver:" .. driverId, "status", "available")
  end

  redis.call("HSET", KEYS[1], "status", "cancelled")
  redis.call("HSET", KEYS[2], "state", "CANCELLED", "finishedAt", ARGV[1])
  redis.call("HINCRBY", KEYS[2], "version", 1)

  return { 1, "SUCCESS" }
`;
