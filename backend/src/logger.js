// logger.js
// Simplified logging module — only three log types: success, info, error.
//
// Usage:
//   const logger = require('./logger');
//   logger.info('Server started', { port: 3000 });
//   logger.success('User registered', { email });
//   logger.error('Something broke', { err });

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Custom levels — only these three exist. Lower number = higher priority.
const customLevels = {
  levels: {
    error: 0,
    success: 1,
    info: 2,
  },
  colors: {
    error: 'red',
    success: 'green',
    info: 'blue',
  },
};

winston.addColors(customLevels.colors);

// Only lets through log entries that match one specific level
// (so each file contains ONLY its own level, nothing else).
const onlyLevel = (level) =>
  winston.format((info) => (info.level === level ? info : false))();

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${stack || message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: 'info', // lets error, success, and info all through
  format: baseFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: winston.format.combine(onlyLevel('error'), baseFormat),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'success.log'),
      format: winston.format.combine(onlyLevel('success'), baseFormat),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'info.log'),
      format: winston.format.combine(onlyLevel('info'), baseFormat),
    }),
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

module.exports = logger;
