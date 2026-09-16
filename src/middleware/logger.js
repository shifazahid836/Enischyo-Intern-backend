/**
 * middleware/logger.js — request logging.
 *
 * Two complementary loggers are exported:
 *
 *  1. requestLogger — a tiny dependency-free middleware that prints the exact
 *     line required by the task spec, measured with the response 'finish' event:
 *
 *         GET /posts - 12ms
 *         POST /posts - 8ms
 *
 *  2. morganLogger — the required "morgan" package, keeping the standard
 *     HTTP log line (method, url, status, response time). In production it
 *     switches to morgan's 'combined' preset (Apache-style access log).
 */

const morgan = require('morgan');

/* -------------------------------------------------------------------------- */
/* 1. Custom request logger                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Logs "<METHOD> <path> - <responseTime>ms" once the response has been sent.
 *
 * @type {import('express').RequestHandler}
 */
function requestLogger(req, res, next) {
  // process.hrtime.bigint() gives a high resolution start timestamp
  const startedAt = process.hrtime.bigint();

  // 'finish' fires when the response is fully sent, so we can measure it
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // Query strings are intentionally stripped so the line matches the spec:
    //   GET /posts - 12ms
    const path = req.originalUrl.split('?')[0];

    console.log(`${req.method} ${path} - ${elapsedMs.toFixed(1)}ms`);
  });

  next();
}

/* -------------------------------------------------------------------------- */
/* 2. morgan logger                                                            */
/* -------------------------------------------------------------------------- */

/**
 * morgan writes one line per request: "GET /posts 200 - 12.431 ms".
 * Health-check pings are skipped to keep the console clean.
 */
const morganLogger = morgan(
  process.env.NODE_ENV === 'production'
    ? 'combined'
    : ':method :url :status - :response-time ms',
  {
    skip: (req) => req.originalUrl === '/health' || req.originalUrl === '/api/health',
  },
);

module.exports = { requestLogger, morganLogger };
