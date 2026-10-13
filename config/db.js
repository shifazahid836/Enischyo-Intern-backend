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

// The connection currently being opened, if any. A serverless runtime can
// receive several requests before the first connection is ready; without this
// each of them would open its own pool.
let pendingConnection = null;

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
  // Trim before validating. A value stored as "MONGODB_URI= mongodb+srv://…"
  // (note the space) is a real-world footgun: dotenv strips it when reading a
  // .env file, but a hosting dashboard keeps the space as part of the value,
  // which used to fail this check with a confusing "missing or invalid" error.
  const connectionString = typeof uri === 'string' ? uri.trim() : uri;

  if (
    !connectionString ||
    typeof connectionString !== 'string' ||
    !connectionString.startsWith('mongodb')
  ) {
    throw new Error(
      'MONGODB_URI is missing or invalid. Add your MongoDB Atlas connection string ' +
        'to backend/.env (see .env.example), or set MONGODB_URI in your hosting provider.'
    );
  }

  attachConnectionListeners();

  // Ready state 1 means "already connected" — reuse the existing pool.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Someone else is already opening it: hand back the same promise.
  if (pendingConnection) {
    return pendingConnection;
  }

  // A fresh connection means any previous close is history
  intentionalDisconnect = false;

  pendingConnection = mongoose
    .connect(connectionString, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
    })
    .then(() => mongoose.connection)
    .finally(() => {
      pendingConnection = null;
    });

  return pendingConnection;
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

/**
 * Describes MONGODB_URI for GET /health WITHOUT revealing any part of it.
 *
 * A deployed API that cannot reach its database is otherwise impossible to
 * diagnose from the outside — you end up guessing in the hosting dashboard.
 * This reports only whether the variable exists and whether its shape is
 * usable, never the value, the host or the credentials.
 *
 * @returns {string} a short, value-free status
 */
function describeMongoUri() {
  const raw = process.env.MONGODB_URI;

  if (raw === undefined) return 'not set in this environment';
  if (typeof raw !== 'string' || raw.trim() === '') return 'set but empty';

  const value = raw.trim();

  if (/^["']/.test(value)) return 'set but wrapped in quotes';
  if (!value.startsWith('mongodb')) return 'set but does not start with "mongodb"';

  // Worth reporting, but no longer fatal — connectDB() trims the value.
  if (raw !== value) return 'ok (surrounding whitespace is trimmed automatically)';

  return 'ok';
}

module.exports = {
  connectDB,
  disconnectDB,
  isDatabaseConnected,
  getConnectionState,
  describeMongoUri,
  mongoose,
};
