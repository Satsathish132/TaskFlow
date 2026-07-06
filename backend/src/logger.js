// logger.js
// Central logging module for the backend, built on Winston.
//
// - Logs to the console (colorized) in all environments.
// - Logs to rotating-friendly files in /logs (errors separately from combined logs).
// - Exposes helper methods: logger.info(), logger.warn(), logger.error(), logger.debug()
//
// Usage:
//   const logger = require('./logger');
//   logger.info('Server started', { port: 3000 });
//   logger.error('Something broke', { err });

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Make sure the logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const isProduction = process.env.NODE_ENV === 'production';

// Shared format: timestamp + level + message, plus any extra metadata as JSON
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // capture stack traces when an Error object is logged
  winston.format.splat(),
  winston.format.json()
);

// Human-friendly format for the console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${stack || message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug', // show debug logs locally, info+ in prod
  format: baseFormat,
  defaultMeta: { service: 'backend' },
  transports: [
    // All logs, level >= 'info', go here
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
    // Only errors go here, for quick scanning
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') }),
  ],
});

// Always also log to the console. Keep it verbose in dev, quieter in prod.
logger.add(
  new winston.transports.Console({
    format: consoleFormat,
    level: isProduction ? 'info' : 'debug',
  })
);

module.exports = logger;
