/**
 * routes/auth.js — URL definitions for /auth.
 *
 * | Method | Path                      | Auth              | Handler          |
 * |--------|---------------------------|-------------------|------------------|
 * | POST   | /auth/register            | public            | register         |
 * | POST   | /auth/login               | public + LIMITED  | login            |
 * | GET    | /auth/me                  | Bearer token      | me               |
 * | PATCH  | /auth/change-password     | Bearer token      | changePassword   |
 * | GET    | /auth/users               | Bearer + admin    | listUsers        |
 * | DELETE | /auth/users/:id           | Bearer + admin    | deleteUser       |
 *
 * "LIMITED" = express-rate-limit: 5 attempts per 15 minutes per IP.
 *
 * Mounted twice by app.js, like every other resource:
 *   /auth/...       and      /api/auth/...
 */

const express = require('express');

const authController = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth');
const { loginLimiter, createLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// --- Public -----------------------------------------------------------------
router.post('/register', createLimiter, asyncHandler(authController.register));

// The rate limiter runs BEFORE the handler, so a 6th bad guess never reaches
// the bcrypt comparison (which is intentionally slow).
router.post('/login', loginLimiter, asyncHandler(authController.login));

// --- Logged in --------------------------------------------------------------
router.get('/me', protect, asyncHandler(authController.me));
router.patch('/change-password', protect, asyncHandler(authController.changePassword));

// --- Admin only -------------------------------------------------------------
router.get('/users', protect, authorize('admin'), asyncHandler(authController.listUsers));
router.delete('/users/:id', protect, authorize('admin'), asyncHandler(authController.deleteUser));

module.exports = router;
