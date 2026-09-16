/**
 * middleware/errorHandler.js — centralised error handling.
 *
 *   notFound      → catches every route that was not matched (404, JSON only)
 *   errorHandler  → single place where all thrown/unexpected errors are turned
 *                   into a consistent JSON response (500 by default)
 *
 * Both are registered LAST in src/app.js so they run after every route.
 */

/**
 * 404 handler for unknown routes.
 * Express reaches this only when nothing else matched the request.
 *
 * @type {import('express').RequestHandler}
 */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
}

/**
 * 500 / unexpected error handler.
 * Express identifies error middleware by its four arguments.
 *
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // express.json() throws a SyntaxError when the body is malformed JSON
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body. Please check the syntax.',
      errors: ['Malformed JSON payload.'],
    });
  }

  // Controllers may attach their own status code (e.g. err.statusCode = 404)
  const statusCode = Number(err.statusCode) || 500;
  const isServerError = statusCode >= 500;

  // Log the full error on the server, but never leak internals to the client
  console.error(`❌ [${statusCode}] ${req.method} ${req.originalUrl} → ${err.message}`);

  const payload = {
    success: false,
    message: isServerError ? 'Internal Server Error' : err.message,
  };

  // Extra debugging detail is only included outside production
  if (isServerError && process.env.NODE_ENV !== 'production') {
    payload.error = err.message;
  }

  return res.status(statusCode).json(payload);
}

module.exports = { notFound, errorHandler };
