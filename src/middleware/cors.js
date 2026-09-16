/**
 * middleware/cors.js — minimal CORS support without an extra dependency.
 *
 * Needed because the Task 1 frontend runs on a different origin
 * (Vite dev server → http://localhost:5173) than this API (port 5000).
 */

/**
 * @type {import('express').RequestHandler}
 */
function cors(req, res, next) {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Pre-flight requests are answered immediately
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

module.exports = cors;
