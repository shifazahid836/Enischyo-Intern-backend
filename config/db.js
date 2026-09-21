/**
 * config/db.js — the ONLY place that talks to MongoDB.
 *
 * Responsibilities:
 *   1. Read the connection string from process.env.MONGODB_URI (.env file)
 *   2. Connect with Mongoose and log the result
 *   3. Report connection state to the rest of the app
 *   4. Close the connection cleanly on shutdown or when a script ends
 *
 * The connection string is never hard-coded, so no credentials ever reach
 * GitHub (see .gitignore / .env.example).
 */

const mongoose = require('mongoose');

// Fail fast on unknown query fields instead of silently ignoring them.
mongoose.set('strictQuery', true);

// The whole app waits at most 10s for the database before giving up.
const CONNECT_TIMEOUT_MS = 10_000;

let listenersAttached = false;

// True while WE are closing the connection on purpose, so a graceful shutdown
// (or a script such as seed.js) does not print a misleading warning.
let intentionalDisconnect = false;

/**
 * Attaches connection event logging exactly once.
 * Useful during development: you can see if Atlas drops the connection.
 */
function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const { connection } = mongoose;

  connection.on('connected', () => {
    console.log(`✅ MongoDB connected (database: ${connection.name})`);
  });

  connection.on('disconnected', () => {
    if (intentionalDisconnect) return; // expected: we closed it ourselves
    console.warn('⚠️  MongoDB disconnected unexpectedly.');
  });

  connection.on('error', (error) => {
    console.error(`❌ MongoDB connection error: ${error.message}`);
  });
}

/**
 * Connects to MongoDB Atlas.
 *
 * @param {string} [uri] Optional override (used by seed.js and tests).
 *                       Defaults to process.env.MONGODB_URI.
 * @returns {Promise<import('mongoose').Connection>}
 * @throws {Error} when MONGODB_URI is missing/invalid or the server is unreachable
 */
async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri || typeof uri !== 'string' || !uri.startsWith('mongodb')) {
    throw new Error(
      'MONGODB_URI is missing or invalid. Create backend/.env and add your ' +
        'MongoDB Atlas connection string (see .env.example).'
    );
  }

  attachConnectionListeners();

  // Ready state 1 means "already connected" — reuse the existing pool.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // A fresh connection means any previous close is history
  intentionalDisconnect = false;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
  });

  return mongoose.connection;
}

/**
 * Closes the connection. Safe to call even when nothing is connected,
 * which makes it perfect for `finally` blocks in scripts.
 */
async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;

  intentionalDisconnect = true; // silence the "disconnected" warning above
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed.');
}

/**
 * @returns {boolean} true when queries can be sent right now
 */
function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Human readable connection state, used by GET /health.
 * @returns {'disconnected'|'connected'|'connecting'|'disconnecting'}
 */
function getConnectionState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}

module.exports = {
  connectDB,
  disconnectDB,
  isDatabaseConnected,
  getConnectionState,
  mongoose,
};
