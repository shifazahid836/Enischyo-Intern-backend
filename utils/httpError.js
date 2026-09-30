/**
 * utils/httpError.js — errors that already know their HTTP status code.
 *
 * A controller can simply do:
 *
 *    if (!job) throw notFound(`Job with id ${id} does not exist.`);
 *
 * `asyncHandler` forwards the error to middleware/errorHandler.js, which reads
 * `statusCode` (and the optional `errors` array) and produces the JSON body.
 * This keeps every controller short and the error format consistent.
 */

/**
 * @param {number} statusCode HTTP status to send (400, 404, 409, 503 …)
 * @param {string} message    human readable, safe to show to the client
 * @param {string[]} [errors] extra details, e.g. one line per invalid field
 * @returns {Error}
 */
function createHttpError(statusCode, message, errors) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (Array.isArray(errors) && errors.length > 0) error.errors = errors;
  return error;
}

/** 400 — the request itself is wrong (bad id, bad query, missing field). */
function badRequest(message, errors) {
  return createHttpError(400, message, errors);
}

/** 404 — a resource addressed by the request does not exist. */
function notFound(message) {
  return createHttpError(404, message);
}

/** 409 — the request conflicts with existing data (duplicate, in use). */
function conflict(message) {
  return createHttpError(409, message);
}

/** 401 — no token, or an invalid/expired one. The client must log in again. */
function unauthorized(message) {
  return createHttpError(401, message);
}

/** 403 — authenticated, but the role / ownership rules forbid this action. */
function forbidden(message) {
  return createHttpError(403, message);
}

/** 503 — the server is up but the database is not reachable right now. */
function serviceUnavailable(message) {
  return createHttpError(503, message);
}

module.exports = {
  createHttpError,
  badRequest,
  notFound,
  conflict,
  unauthorized,
  forbidden,
  serviceUnavailable,
};
