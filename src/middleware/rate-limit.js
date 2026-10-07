/* Small in-memory limit per IP, so the API can't be used to flood the inbox or burn Google quota. */
function rateLimit({ max, windowMs, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, times] of hits) {
      if (times.every((time) => now - time >= windowMs)) hits.delete(ip);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((time) => now - time < windowMs);
    recent.push(now);
    hits.set(req.ip, recent);
    if (recent.length > max) return res.status(429).json({ ok: false, error: message });
    next();
  };
}

module.exports = rateLimit;
