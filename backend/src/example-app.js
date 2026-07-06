// example-app.js
// Minimal example showing how to wire logger.js + logging-middleware.js
// into an Express app. Not required — just a reference.

const express = require('express');
const logger = require('./logger');
const { requestLogger, errorLogger } = require('./logging-middleware');

const app = express();

// 1. Log every request (register early, before routes)
app.use(requestLogger);

app.get('/', (req, res) => {
  logger.debug('Handling root route');
  res.send('Hello world');
});

app.get('/boom', (req, res) => {
  throw new Error('Something went wrong on purpose');
});

// 2. Log any error that bubbles up (register after routes)
app.use(errorLogger);

// 3. Your normal error responder, after errorLogger
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
