/**
 * routes/applications.js — URL definitions for /applications.
 *
 * | Method | Path                | Auth required       | Handler            |
 * |--------|---------------------|---------------------|--------------------|
 * | GET    | /applications       | public              | listApplications   |
 * | POST   | /applications       | Bearer + jobseeker  | createApplication  |
 * | GET    | /applications/:id   | public              | getApplicationById |
 * | PUT    | /applications/:id   | Bearer + admin      | updateApplication  |
 * | DELETE | /applications/:id   | Bearer + admin      | deleteApplication  |
 *
 * Applying is a jobseeker-only action: an employer should not be able to apply
 * to a posting. Reviewing (status change) and deleting are back-office actions,
 * so they are limited to admins — "only admins can delete any resource".
 */

const express = require('express');

const applicationController = require('../controllers/applicationController');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(asyncHandler(applicationController.listApplications))
  .post(protect, authorize('jobseeker'), asyncHandler(applicationController.createApplication));

router
  .route('/:id')
  .get(asyncHandler(applicationController.getApplicationById))
  .put(protect, authorize('admin'), asyncHandler(applicationController.updateApplication))
  .delete(protect, authorize('admin'), asyncHandler(applicationController.deleteApplication));

module.exports = router;
