/**
 * utils/jwt.js — the ONLY place that creates and verifies JSON Web Tokens.
 *
 * Why a wrapper instead of calling jsonwebtoken everywhere?
 *   • the secret and the expiry are read in ONE place (backend/.env);
 *   • the payload shape ({ sub, role }) is always the same;
 *   • a missing JWT_SECRET produces one clear, actionable error instead of
 *     "secretOrPrivateKey must have a value" from deep inside the library.
 *
 * Tokens are stateless: the server does not store them. Everything the API
 * needs on later requests is inside the token (the user id in `sub`) plus the
 * role, and `middleware/auth.js` re-loads the user from MongoDB on every
 * request so a deleted account or a changed role takes effect immediately.
 */

const jwt = require('jsonwebtoken');

// 7 days, as required by the task spec. Override with JWT_EXPIRES_IN in .env
// (for example "1h" while testing, or "30d" for a long-lived session).
const DEFAULT_EXPIRES_IN = '7d';

// A short secret can be brute-forced offline, so refuse to run with one.
const MIN_SECRET_LENGTH = 32;

// Marks the tokens this API issued, so a token signed by another service
// (with the same secret) is still rejected.
const ISSUER = 'enischyo-api';

/**
 * Reads and validates JWT_SECRET from the environment.
 *
 * @returns {string}
 * @throws {Error} when the secret is missing or too short
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret === 'string' && secret.trim().length >= MIN_SECRET_LENGTH) {
    return secret.trim();
  }

  throw new Error(
    `JWT_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters. ` +
      'Add a long random value to backend/.env (see .env.example) and restart the server.'
  );
}

/**
 * @returns {boolean} true when JWT_SECRET is usable (used by server.js at boot)
 */
function isJwtConfigured() {
  try {
    getJwtSecret();
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {string} token lifetime, e.g. "7d"
 */
function getExpiresIn() {
  const configured = process.env.JWT_EXPIRES_IN;
  return typeof configured === 'string' && configured.trim() ? configured.trim() : DEFAULT_EXPIRES_IN;
}

/**
 * Creates the token returned by register / login.
 *
 * The payload is deliberately small: `sub` (subject = the user id, a JWT
 * standard claim) and `role`. Never put the password or any secret in here —
 * a JWT is signed, not encrypted, so anyone can read it.
 *
 * @param {{ _id: unknown, role: string }} user
 * @returns {string} the signed token
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: getExpiresIn(),
      issuer: ISSUER,
    }
  );
}

/**
 * Verifies a token and returns its payload.
 *
 * @param {string} token
 * @returns {{ sub: string, role: string, iat: number, exp: number }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), { issuer: ISSUER });
}

/**
 * Reads the payload WITHOUT verifying it. Only useful for logging/debugging —
 * never trust the result of this function.
 *
 * @param {string} token
 * @returns {object|null}
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  signToken,
  verifyToken,
  decodeToken,
  getJwtSecret,
  isJwtConfigured,
  getExpiresIn,
  DEFAULT_EXPIRES_IN,
  ISSUER,
};
