/**
 * middleware/rateLimit.js — brute-force protection for the login endpoint.
 *
 * POST /auth/login is the one endpoint where an attacker can simply guess
 * passwords, so it is limited to 5 attempts per 15 minutes per IP address.
 * A 6th attempt inside the window is answered with:
 *
 *   429 Too Many Requests
 *   { "success": false, "message": "Too many login attempts ..." }
 *
 * Notes:
 *   • The counter is stored in memory. That is perfect for one process
 *     (development, a single server) but resets on restart and is not shared
 *     between several instances — use a Redis store
 *     (express-rate-limit → `store`) when the API runs behind a load balancer.
 *   • Registering a NEW account is not limited here; if your signup page is
 *     abused, mount `createLimiter` on it as well.
 */

const rateLimit = require('express-rate-limit');

const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_ATTEMPTS = 5;

/**
 * Shared error body so every limiter answers in the API's usual shape.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} label
 */
function sendTooManyRequests(req, res, label) {
  // express-rate-limit v7 exposes the counter state on req.rateLimit.
  const resetTime = req.rateLimit && req.rateLimit.resetTime;
  const secondsUntilReset =
    resetTime instanceof Date ? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : undefined;

  res.status(429).json({
    success: false,
    message: `Too many ${label} attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes.`,
    errors: [
      `${label} is limited to ${LOGIN_MAX_ATTEMPTS} attempts per ${LOGIN_WINDOW_MINUTES} minutes.`,
    ],
    ...(secondsUntilReset === undefined ? {} : { retryAfterSeconds: secondsUntilReset }),
  });
}

/**
 * 5 attempts / 15 minutes — mounted on POST /auth/login only.
 * Successful logins count too, so a script that logs in on every request is
 * stopped as well. Add `skipSuccessfulRequests: true` if that is too strict.
 *
 * @type {import('express').RequestHandler}
 */
const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MINUTES * 60 * 1000,
  limit: LOGIN_MAX_ATTEMPTS,
  standardHeaders: 'draft-7', // adds the RateLimit-* response headers
  legacyHeaders: false, // do not send the old X-RateLimit-* headers
  handler: (req, res) => sendTooManyRequests(req, res, 'login'),
});

/**
 * A looser limiter for other write-heavy endpoints (registration, comments…).
 * 30 requests / 15 minutes: generous for a human, useless for a bot.
 *
 * @type {import('express').RequestHandler}
 */
const createLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MINUTES * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => sendTooManyRequests(req, res, 'create'),
});

module.exports = {
  loginLimiter,
  createLimiter,
  LOGIN_WINDOW_MINUTES,
  LOGIN_MAX_ATTEMPTS,
};
