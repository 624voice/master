/**
 * Phone idempotency + daily rate limit with four cases and four replay substates.
 *
 * Case (a) fresh: first submission within phone window.
 * Case (b) replay_exact: same idempotency key + payload hash, return cached response.
 * Case (c) replay_conflict: phone limit exceeded or payload mismatch on same key.
 * Case (d) replay_stale: idempotency record expired but phone still under limit.
 *
 * Substates: fresh | replay_exact | replay_stale | replay_conflict
 *
 * KEYS[1] phone zset key
 * KEYS[2] idempotency record key
 * ARGV[1] idempotency key
 * ARGV[2] payload hash
 * ARGV[3] window start score
 * ARGV[4] now score
 * ARGV[5] phone limit
 * ARGV[6] ttl seconds
 * ARGV[7] cached response json
 * ARGV[8] unique zset member
 */
export const RATE_LIMIT_PHONE_IDEMPOTENCY_LUA = `
local phone_key = KEYS[1]
local idem_key = KEYS[2]
local idempotency_key = ARGV[1]
local payload_hash = ARGV[2]
local window_start = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local phone_limit = tonumber(ARGV[5])
local ttl = tonumber(ARGV[6])
local cached_response = ARGV[7]
local member = ARGV[8]

local existing = redis.call('GET', idem_key)
if existing then
  local decoded = cjson.decode(existing)
  if decoded.payload_hash == payload_hash then
    return {'b', 'replay_exact', 1, decoded.count or 0, decoded.response}
  end
  return {'c', 'replay_conflict', 0, decoded.count or 0, decoded.response}
end

redis.call('ZREMRANGEBYSCORE', phone_key, '-inf', window_start)
local count = redis.call('ZCARD', phone_key)

if count >= phone_limit then
  return {'c', 'replay_conflict', 0, count, nil}
end

local stale_marker = redis.call('GET', idem_key .. ':stale:' .. idempotency_key)
local substate = 'fresh'
local case_id = 'a'
if stale_marker then
  substate = 'replay_stale'
  case_id = 'd'
end

redis.call('ZADD', phone_key, now, member)
redis.call('EXPIRE', phone_key, ttl)

local record = cjson.encode({
  payload_hash = payload_hash,
  response = cached_response,
  count = count + 1,
  idempotency_key = idempotency_key
})
redis.call('SET', idem_key, record, 'EX', ttl)

return {case_id, substate, 1, count + 1, cached_response}
`.trim();
