/**
 * utils/asyncHandler.js — wrapper for async route handlers.
 *
 * Express 4 does NOT catch rejected promises: an async handler that throws
 * would leave the request hanging forever. This helper turns
 *
 *    router.get('/', asyncHandler(jobController.listJobs));
 *
 * into the equivalent of `(req, res, next) => promise.catch(next)`, so every
 * thrown error reaches middleware/errorHandler.js.
 *
 * (Express 5 does this automatically — this wrapper keeps the code working on
 * Express 4, which is what this project uses.)
 *
 * @param {import('express').RequestHandler} handler
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
