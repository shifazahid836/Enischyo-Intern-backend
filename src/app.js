/**
 * src/app.js — Express application configuration.
 *
 * Middleware order matters:
 *   1. CORS + body parsers      → prepare the request
 *   2. Loggers (morgan + custom) → log the request
 *   3. Routes                    → handle the request
 *   4. notFound (404)            → nothing matched
 *   5. errorHandler (500)        → anything thrown above
 *
 * The actual HTTP listening happens in server.js, which keeps this file
 * testable and reusable.
 */

// Loaded here as well so app.js can be required on its own (tests, scripts).
require('dotenv').config();

const express = require('express');

const cors = require('./middleware/cors');
const { morganLogger, requestLogger } = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');

const app = express();

// Small security/DX touches
app.disable('x-powered-by');

// --- Global middleware -------------------------------------------------------
app.use(cors);
app.use(morganLogger); // morgan: "GET /posts 200 - 12.4 ms"
app.use(requestLogger); // custom: "GET /posts - 12.4ms"
app.use(express.json()); // parse application/json bodies
app.use(express.urlencoded({ extended: true })); // parse form bodies

// --- Health check ------------------------------------------------------------
const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Blog API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// --- API routes --------------------------------------------------------------
/**
 * Routes are mounted under both "/" and "/api" so that:
 *   • the plain paths from the task spec work:  GET /posts
 *   • the namespaced paths work too:            GET /api/posts
 *
 * The second form is what the Vite frontend proxy expects, so the Task 1
 * frontend can talk to this API without extra configuration.
 */
function mountApiRoutes(basePath) {
  app.use(`${basePath}/posts`, postRoutes); // posts + nested comments
  app.use(`${basePath}/comments`, commentRoutes); // DELETE /comments/:id
}

mountApiRoutes('');
mountApiRoutes('/api');

// --- 404 + centralised error handling (must be registered last) --------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
