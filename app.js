/**
 * app.js — Express application configuration.
 *
 * Middleware order matters:
 *   1. CORS + body parsers       → prepare the request
 *   2. Loggers (morgan + custom) → log the request
 *   3. Routes                    → handle the request
 *   4. notFound (404)            → nothing matched
 *   5. errorHandler (500)        → anything thrown above
 *
 * The actual HTTP listening happens in server.js, which keeps this file
 * testable and reusable.
 *
 * Every resource below is stored in MongoDB, so all routes are protected by
 * `requireDatabase` (immediate 503 instead of a long timeout when the database
 * is unreachable). Only /health stays available without a database.
 */

// Loaded here as well so app.js can be required on its own (tests, scripts).
require('dotenv').config();

const express = require('express');

const cors = require('./middleware/cors');
const { morganLogger, requestLogger } = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const requireDatabase = require('./middleware/requireDatabase');
const { connectDB, getConnectionState, describeMongoUri } = require('./config/db');
const { isJwtConfigured } = require('./utils/jwt');

const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const companyRoutes = require('./routes/companies');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const authRoutes = require('./routes/auth');

const app = express();

// Small security/DX touches
app.disable('x-powered-by');

// --- Global middleware -------------------------------------------------------
app.use(cors);
app.use(morganLogger); // morgan: "GET /jobs 200 - 12.4 ms"
app.use(requestLogger); // custom: "GET /jobs - 12.4ms"
app.use(express.json()); // parse application/json bodies
app.use(express.urlencoded({ extended: true })); // parse form bodies

// --- Health check ------------------------------------------------------------

/**
 * Reports whether the environment is configured, never what it contains.
 *
 * Attached to GET /health only while the database is unreachable, so a
 * misconfigured deployment can be diagnosed from the outside instead of by
 * guessing in the hosting dashboard. Every value here is a fixed status
 * string — no secret, host or credential is ever echoed.
 *
 * @returns {Record<string, string>}
 */
function describeConfiguration() {
  return {
    MONGODB_URI: describeMongoUri(),
    JWT_SECRET: isJwtConfigured() ? 'ok' : 'missing or shorter than 32 characters',
    NODE_ENV: process.env.NODE_ENV || 'not set',
    CORS_ORIGIN: process.env.CORS_ORIGIN ? 'set' : 'not set (defaults to *)',
  };
}

const healthCheck = async (req, res) => {
  // A serverless cold start begins disconnected: nothing has queried yet. Open
  // the connection here so this endpoint reports the real state (and so the
  // first real request afterwards is fast). Failures are reported, not thrown.
  try {
    await connectDB();
  } catch {
    /* the "database" field below already describes the failure */
  }

  const database = getConnectionState();

  res.status(200).json({
    success: true,
    message: 'Blog API is running',
    service: 'Job Board API (MongoDB + Mongoose)',
    environment: process.env.NODE_ENV || 'development',
    database, // connected | connecting | disconnected
    ...(database === 'connected' ? {} : { configuration: describeConfiguration() }),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// --- API routes --------------------------------------------------------------
/**
 * Routes are mounted under both "/" and "/api" so that:
 *   • the plain paths from the task spec work:  GET /jobs
 *   • the namespaced paths work too:            GET /api/jobs
 *
 * The second form is what a Vite frontend proxy usually expects.
 */
function mountApiRoutes(basePath) {
  app.use(`${basePath}/auth`, requireDatabase, authRoutes); // register / login / me
  app.use(`${basePath}/jobs`, requireDatabase, jobRoutes);
  app.use(`${basePath}/companies`, requireDatabase, companyRoutes);
  app.use(`${basePath}/applications`, requireDatabase, applicationRoutes);
  app.use(`${basePath}/posts`, requireDatabase, postRoutes); // blog + nested comments
  app.use(`${basePath}/comments`, requireDatabase, commentRoutes); // DELETE /comments/:id
}

mountApiRoutes('');
mountApiRoutes('/api');

// --- 404 + centralised error handling (must be registered last) --------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
