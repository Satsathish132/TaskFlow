// logging-middleware.js
// Express middleware that pairs with logger.js.
//
// - requestLogger: logs every incoming request and how long it took.
// - errorLogger:    logs any error that reaches Express's error handler,
//                    then passes it along so your normal error responder can run.

const logger = require('./logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
    });
  });

  next();
}

// IMPORTANT: Express error-handling middleware must take 4 arguments,
// and must be registered AFTER all your routes.
function errorLogger(err, req, res, next) {
  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });
  next(err); // hand off to your actual error response logic
}

module.exports = { requestLogger, errorLogger };
