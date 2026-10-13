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

// --- API index ---------------------------------------------------------------
/**
 * GET / and GET /api — a short, human-readable map of the service.
 *
 * Opening a deployed base URL used to answer
 * `{"success":false,"message":"Route not found","method":"GET","path":"/"}`,
 * simply because no root route existed. That reads like a broken deployment
 * even when every real endpoint is healthy, so the root is now self-describing.
 *
 * It stays useful when the database is down: the handler only reports the
 * connection state, it does not need a working one.
 */
const apiIndex = async (req, res) => {
  // A serverless cold start begins disconnected: warm the connection so the
  // state below is accurate instead of a misleading "disconnected".
  try {
    await connectDB();
  } catch {
    /* the "database" field below already describes the failure */
  }

  res.status(200).json({
    success: true,
    service: 'TechJobs — Job Board API',
    description:
      'REST API for the TechJobs job board: jobs, companies and applications, ' +
      'JWT authentication with roles, plus the original blog endpoints.',
    environment: process.env.NODE_ENV || 'development',
    database: getConnectionState(),
    health: '/health',
    docs: 'https://github.com/shifazahid836/Enischyo-Intern-backend#-api-endpoints',
    note: 'Every resource is also mounted without the /api prefix, e.g. GET /jobs.',
    endpoints: {
      auth: [
        'POST   /api/auth/register',
        'POST   /api/auth/login',
        'GET    /api/auth/me                    (token)',
        'PATCH  /api/auth/change-password       (token)',
        'GET    /api/auth/users                 (admin)',
        'DELETE /api/auth/users/:id             (admin)',
      ],
      jobs: [
        'GET    /api/jobs                       ?keyword=&location=&type=&company=&isActive=',
        'GET    /api/jobs/:id',
        'POST   /api/jobs                       (employer)',
        'PUT    /api/jobs/:id                   (owning employer)',
        'DELETE /api/jobs/:id                   (owning employer or admin)',
      ],
      companies: [
        'GET    /api/companies',
        'GET    /api/companies/:id',
        'POST   /api/companies',
        'PUT    /api/companies/:id',
        'DELETE /api/companies/:id              (admin)',
      ],
      applications: [
        'GET    /api/applications',
        'GET    /api/applications/:id',
        'POST   /api/applications               (jobseeker)',
        'PUT    /api/applications/:id           (admin)',
        'DELETE /api/applications/:id           (admin)',
      ],
      posts: [
        'GET    /api/posts',
        'GET    /api/posts/:id',
        'POST   /api/posts',
        'PUT    /api/posts/:id',
        'DELETE /api/posts/:id                  (admin)',
        'GET    /api/posts/:id/comments',
        'POST   /api/posts/:id/comments',
      ],
      comments: ['DELETE /api/comments/:id              (admin)'],
    },
  });
};

app.get('/', apiIndex);
app.get('/api', apiIndex);

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
