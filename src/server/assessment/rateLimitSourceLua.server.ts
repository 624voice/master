/**
 * Sorted-set sliding-window rate limit with unique members per request.
 *
 * Returns: { allowed (0|1), count, status }
 *   allowed = 1 when under limit and member was recorded
 *   allowed = 0 when limit exceeded
 */
export const RATE_LIMIT_SOURCE_LUA = `
local key = KEYS[1]
local window_start = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)

if count >= limit then
  return {0, count, 'limited'}
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl)

return {1, count + 1, 'allowed'}
`.trim();
