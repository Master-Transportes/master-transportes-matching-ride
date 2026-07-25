export const ACCEPT_OFFER_LUA = `
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
  if matchingState ~= "WAITING_RESPONSE" then
    return { 0, "RIDE_NOT_WAITING" }
  end

  redis.call("HSET", KEYS[1], "status", "accepted")
  redis.call("HSET", KEYS[2], "state", "MATCHED")
  redis.call("HINCRBY", KEYS[2], "version", 1)

  return { 1, "SUCCESS" }
`;
