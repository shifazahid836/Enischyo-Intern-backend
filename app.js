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
const { getConnectionState } = require('./config/db');

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
const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Blog API is running',
    service: 'Job Board API (MongoDB + Mongoose)',
    environment: process.env.NODE_ENV || 'development',
    database: getConnectionState(), // connected | connecting | disconnected
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
