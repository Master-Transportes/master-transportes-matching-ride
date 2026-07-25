export const CLOSE_OFFER_LUA = `
  local offerStatus = redis.call("HGET", KEYS[1], "status")
  if offerStatus ~= "pending" then
    return { 0, "OFFER_NOT_PENDING" }
  end

  local currentDriver = redis.call("HGET", KEYS[1], "driverId")
  if currentDriver ~= ARGV[1] then
    return { 0, "DRIVER_MISMATCH" }
  end

  local matchingState = redis.call("HGET", KEYS[2], "state")
  if matchingState == "MATCHED" then
    return { 0, "RIDE_ALREADY_MATCHED" }
  end
  if matchingState == "CANCELLED" then
    return { 0, "RIDE_CANCELLED" }
  end

  local driverId = redis.call("HGET", KEYS[1], "driverId")
  if driverId then
    redis.call("HSET", "driver:" .. driverId, "status", "available")
  end

  redis.call("HSET", KEYS[1], "status", ARGV[2])
  redis.call("HSET", KEYS[2], "state", "SEARCHING")
  redis.call("HDEL", KEYS[2], "currentOfferId", "currentDriverId")
  redis.call("HINCRBY", KEYS[2], "version", 1)

  return { 1, "SUCCESS" }
`;
