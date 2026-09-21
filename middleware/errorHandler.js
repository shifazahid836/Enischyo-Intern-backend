/**
 * middleware/errorHandler.js — centralised error handling.
 *
 *   notFound      → catches every route that was not matched (404, JSON only)
 *   errorHandler  → single place where all thrown/unexpected errors are turned
 *                   into a consistent JSON response
 *
 * Both are registered LAST in app.js so they run after every route.
 *
 * Because the API now uses Mongoose, the handler also translates the errors
 * MongoDB itself produces:
 *   • CastError         → 400 (an id / value has the wrong type)
 *   • ValidationError   → 400 (schema rules, e.g. a missing required field)
 *   • code 11000        → 409 (duplicate value, e.g. the same company name)
 *   • network errors    → 503 (Atlas unreachable / connection dropped)
 *
 * Anything a controller marks itself (utils/httpError.js → err.statusCode)
 * is used as-is.
 */

const { getConnectionState } = require('../config/db');

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
 * Mongoose validation failure → one line per invalid field.
 *
 * @param {Error} err
 * @returns {{ statusCode: number, message: string, errors: string[] }}
 */
function translateValidationError(err) {
  const errors = Object.values(err.errors).map(
    (detail) => detail.message || `${detail.path} is invalid.`
  );

  return {
    statusCode: 400,
    message: 'Validation failed. Please check the highlighted fields.',
    errors,
  };
}

/**
 * Duplicate key (unique index) → 409 Conflict.
 *
 * @param {Error} err
 * @returns {{ statusCode: number, message: string, errors: string[] }}
 */
function translateDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue ? err.keyValue[field] : '';

  return {
    statusCode: 409,
    message: `A record with this ${field} already exists${value ? ` ("${value}")` : ''}.`,
    errors: [`Duplicate value for "${field}".`],
  };
}

/**
 * True when the failure is "the database is unreachable" rather than a bug.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isDatabaseConnectionError(err) {
  const name = err.name || '';
  const message = err.message || '';

  if (
    [
      'MongooseServerSelectionError',
      'MongoNetworkError',
      'MongoServerSelectionError',
      'MongoTimeoutError',
      'MongoNotConnectedError',
      'MongooseError',
    ].includes(name) &&
    /(buffer|timed out|timeout|connect|topology|ECONNREFUSED|ENOTFOUND|getaddrinfo)/i.test(message)
  ) {
    return true;
  }

  return /(buffering timed out|failed to connect|server selection failed)/i.test(message);
}

/**
 * 500 / unexpected error handler.
 * Express identifies error middleware by its four arguments.
 *
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 1. express.json() throws a SyntaxError when the body is malformed JSON
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body. Please check the syntax.',
      errors: ['Malformed JSON payload.'],
    });
  }

  // 2. Translate the errors MongoDB / Mongoose are known to produce
  let translated = null;

  if (err.name === 'CastError') {
    // e.g. "not-an-id" used where a Mongo ObjectId was expected
    translated = {
      statusCode: 400,
      message: `Invalid value for "${err.path}": "${err.value}". Expected a ${err.kind}.`,
      errors: [`"${err.value}" is not a valid ${err.kind} for field "${err.path}".`],
    };
  } else if (err.name === 'ValidationError' && err.errors) {
    translated = translateValidationError(err);
  } else if (err.code === 11000) {
    translated = translateDuplicateKeyError(err);
  } else if (isDatabaseConnectionError(err)) {
    translated = {
      statusCode: 503,
      message:
        'The database is unavailable. Check MONGODB_URI in backend/.env and your MongoDB Atlas network access.',
      errors: [`Database connection problem (${err.name || 'error'}).`],
    };
  }

  // 3. Errors created by controllers (utils/httpError.js) carry their own code
  const statusCode = translated
    ? translated.statusCode
    : Number(err.statusCode) || 500;

  const isServerError = statusCode >= 500;

  // Log the full error on the server, but never leak internals to the client
  console.error(`❌ [${statusCode}] ${req.method} ${req.originalUrl} → ${err.message}`);

  const payload = {
    success: false,
    message: translated ? translated.message : isServerError ? 'Internal Server Error' : err.message,
  };

  // Field-level details (validation, duplicates, custom errors)
  if (translated && translated.errors) {
    payload.errors = translated.errors;
  } else if (Array.isArray(err.errors) && err.errors.length > 0) {
    payload.errors = err.errors;
  }

  // Database state helps diagnose 5xx problems during development
  if (isServerError) {
    payload.databaseState = getConnectionState();
  }

  // Extra debugging detail is only included outside production
  if (isServerError && process.env.NODE_ENV !== 'production') {
    payload.error = err.message;
  }

  return res.status(statusCode).json(payload);
}

module.exports = { notFound, errorHandler };
