/**
 * middleware/requireDatabase.js — opens the connection on demand, or answers 503.
 *
 * A long-running server connects once at boot (see server.js), so here this is
 * only a cheap guard. A serverless runtime is different: Vercel imports app.js
 * and never runs server.js, so the first request after a cold start is what has
 * to open the connection. Waiting for it here keeps every database-backed route
 * working without any runtime-specific start-up code.
 *
 * When the connection cannot be opened the client gets a precise answer instead
 * of a vague timeout:
 *
 *   503 Service Unavailable
 *   { "success": false, "message": "Database is not connected ..." }
 *
 * It is mounted only on the database-backed routes, so GET /health keeps
 * working (and reports the connection state) even when Atlas is down.
 */

const { connectDB, isDatabaseConnected, getConnectionState } = require('../config/db');

/**
 * @type {import('express').RequestHandler}
 */
async function requireDatabase(req, res, next) {
  // Already connected — the normal case on a warm instance.
  if (isDatabaseConnected()) return next();

  try {
    await connectDB();
    return next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      message:
        'Database is not connected, so this request cannot be served right now. ' +
        'Check MONGODB_URI and your MongoDB Atlas network access.',
      databaseState: getConnectionState(),
      errors: [error.message],
    });
  }
}

module.exports = requireDatabase;
