/**
 * middleware/auth.js — authentication (who are you?) and authorisation (what
 * are you allowed to do?).
 *
 * Usage in a route file:
 *
 *    router.post('/', protect, authorize('employer'), createJob);
 *
 * `protect` does four things:
 *   1. reads the token from the "Authorization: Bearer <token>" header
 *   2. verifies the signature + expiry with jsonwebtoken
 *   3. loads the user from MongoDB (so a deleted account or a changed role is
 *      respected immediately, instead of trusting a token that may be 7 days old)
 *   4. attaches the document to `req.user`
 *
 * A missing/invalid token is 401 Unauthorized. A valid token with the wrong
 * role is 403 Forbidden — a deliberately different code, because the client is
 * authenticated but simply not allowed.
 */

const User = require('../models/User');
const { unauthorized, forbidden } = require('../utils/httpError');
const { verifyToken } = require('../utils/jwt');
const { isValidObjectId } = require('../utils/validation');

/**
 * Pulls the raw token out of an Authorization header value.
 *
 * @param {unknown} headerValue e.g. "Bearer eyJhbGciOi..."
 * @returns {string|null} the token, or null when the header is missing/malformed
 */
function extractBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;

  const [scheme, ...rest] = headerValue.trim().split(/\s+/);
  const token = rest.join('');

  if (!/^bearer$/i.test(scheme || '') || token.length === 0) return null;

  return token;
}

/**
 * Requires a valid Bearer token and sets `req.user`.
 *
 * @type {import('express').RequestHandler}
 */
async function protect(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw unauthorized(
        'Authentication required. Send an "Authorization: Bearer <token>" header with the token from POST /auth/login.'
      );
    }

    let payload;

    try {
      payload = verifyToken(token);
    } catch (error) {
      // Both cases are 401: the client must log in again to get a new token.
      if (error.name === 'TokenExpiredError') {
        throw unauthorized('Your token has expired. Please log in again.');
      }

      throw unauthorized('Invalid token. Please log in again.');
    }

    if (!isValidObjectId(payload.sub)) {
      throw unauthorized('Invalid token payload. Please log in again.');
    }

    // Re-reading the user on every request keeps the token honest.
    const user = await User.findById(payload.sub);

    if (!user) {
      throw unauthorized('The account belonging to this token no longer exists.');
    }

    req.user = user;
    req.token = token;

    return next();
  } catch (error) {
    return next(error); // → middleware/errorHandler.js
  }
}

/**
 * Role gate. Must be used AFTER `protect`.
 *
 *    router.post('/', protect, authorize('employer'), handler)
 *    router.delete('/:id', protect, authorize('employer', 'admin'), handler)
 *
 * @param {...(string|string[])} roles allowed roles
 * @returns {import('express').RequestHandler}
 */
function authorize(...roles) {
  const allowedRoles = roles
    .flat()
    .map((role) => String(role).trim().toLowerCase())
    .filter(Boolean);

  return function authorizeRole(req, res, next) {
    if (!req.user) {
      return next(
        unauthorized('Authentication required before this action can be authorised.')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        forbidden(
          `Access denied. This action requires the role: ${allowedRoles.join(' or ')}. ` +
            `Your account role is "${req.user.role}".`
        )
      );
    }

    return next();
  };
}

/**
 * Attaches `req.user` when a valid token is present, but never blocks the
 * request. Handy for endpoints that show more data to the owner.
 *
 * @type {import('express').RequestHandler}
 */
async function optionalAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) return next();

  try {
    const payload = verifyToken(token);

    if (isValidObjectId(payload.sub)) {
      const user = await User.findById(payload.sub);
      if (user) req.user = user;
    }
  } catch {
    // A bad token on an optional route is simply ignored.
  }

  return next();
}

module.exports = {
  protect,
  authorize,
  // Alias: reads better in some route files ("requireRole('admin')").
  requireRole: authorize,
  optionalAuth,
  extractBearerToken,
};
