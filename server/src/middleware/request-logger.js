export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => console.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`));
  next();
}
