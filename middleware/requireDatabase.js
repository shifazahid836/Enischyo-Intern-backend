/**
 * middleware/requireDatabase.js — friendly 503 when MongoDB is unreachable.
 *
 * Without this guard, a request that arrives while the database is down would
 * sit in Mongoose's buffer until it times out (10s) and then produce a vague
 * error. Instead the client immediately gets:
 *
 *   503 Service Unavailable
 *   { "success": false, "message": "Database is not connected ..." }
 *
 * It is mounted only on the database-backed routes, so GET /health keeps
 * working (and reports the connection state) even when Atlas is down.
 */

const { isDatabaseConnected, getConnectionState } = require('../config/db');

/**
 * @type {import('express').RequestHandler}
 */
function requireDatabase(req, res, next) {
  if (isDatabaseConnected()) return next();

  return res.status(503).json({
    success: false,
    message:
      'Database is not connected, so this request cannot be served right now. ' +
      'Check MONGODB_URI in backend/.env and your MongoDB Atlas network access, then restart the server.',
    databaseState: getConnectionState(),
  });
}

module.exports = requireDatabase;
