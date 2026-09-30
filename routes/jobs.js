/**
 * routes/jobs.js — URL definitions for /jobs.
 *
 * | Method | Path       | Auth required             | Handler      |
 * |--------|------------|---------------------------|--------------|
 * | GET    | /jobs      | public                    | listJobs     |
 * | POST   | /jobs      | Bearer + employer         | createJob    |
 * | GET    | /jobs/:id  | public                    | getJobById   |
 * | PUT    | /jobs/:id  | Bearer + owning employer  | updateJob    |
 * | DELETE | /jobs/:id  | Bearer + owner **or** admin | deleteJob |
 *
 * "owning employer" = the user whose id is stored in `job.employer`, i.e. the
 * person who created the posting.
 *
 * The ownership test itself lives in controllers/jobController.js: that
 * controller has already loaded the document, so checking the owner there saves
 * a second database round-trip that a separate middleware would need.
 *
 * Every handler is wrapped in asyncHandler so a rejected promise becomes a
 * proper JSON error response instead of a hanging request.
 */

const express = require('express');

const jobController = require('../controllers/jobController');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router
  .route('/')
  .get(asyncHandler(jobController.listJobs))
  // Only employers advertise jobs — a jobseeker or an admin gets 403 here.
  .post(protect, authorize('employer'), asyncHandler(jobController.createJob));

router
  .route('/:id')
  .get(asyncHandler(jobController.getJobById))
  // An admin may delete someone else's posting (per the spec) but not edit it.
  .put(protect, authorize('employer'), asyncHandler(jobController.updateJob))
  .delete(protect, authorize('employer', 'admin'), asyncHandler(jobController.deleteJob));

module.exports = router;
