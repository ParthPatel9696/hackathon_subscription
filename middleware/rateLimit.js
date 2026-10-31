const createRateLimiter = ({ windowMs, max, message = 'Too many attempts. Please wait before trying again.' }) => {
  const entries = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
  }, Math.min(windowMs, 60_000));
  cleanup.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.baseUrl || ''}${req.path || req.url}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, error: message });
    }
    if (entries.size > 10_000) {
      for (const [entryKey, value] of entries) if (value.resetAt <= now) entries.delete(entryKey);
    }
    return next();
  };
};

module.exports = { createRateLimiter };
