export const PUBLIC_RATE_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_RATE_LIMIT_DEFAULT = 120;

const buckets = new Map();

export function publicRateLimitMax() {
  const raw = process.env.PUBLIC_ASSESS_RATE_LIMIT;
  if (raw == null || String(raw).trim() === "") return PUBLIC_RATE_LIMIT_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return PUBLIC_RATE_LIMIT_DEFAULT;
  return Math.floor(parsed);
}

export function resetPublicRateLimit() {
  buckets.clear();
}

export function clientAddress(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function consumePublicRateLimit(key, now = Date.now()) {
  const windowMs = PUBLIC_RATE_WINDOW_MS;
  const max = publicRateLimitMax();
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) || []).filter((stamp) => stamp > cutoff);

  if (recent.length >= max) {
    buckets.set(key, recent);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((recent[0] + windowMs - now) / 1000),
    );
    return { ok: false, retryAfterSeconds, limit: max, windowMs };
  }

  recent.push(now);
  if (!buckets.has(key) && buckets.size >= 5000) {
    const oldest = buckets.keys().next().value;
    buckets.delete(oldest);
  }
  buckets.set(key, recent);
  return { ok: true, retryAfterSeconds: 0, limit: max, windowMs };
}

export function publicAssessRateLimit(req, res, next) {
  const result = consumePublicRateLimit(clientAddress(req));
  if (!result.ok) {
    res.set("Retry-After", String(result.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error:
        "Rate limit exceeded for the public assessment demo. Wait and try again.",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
  return next();
}
