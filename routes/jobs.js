/**
 * routes/jobs.js — URL definitions for /jobs.
 *
 * | Method | Path       | Handler                        |
 * |--------|------------|--------------------------------|
 * | GET    | /jobs      | listJobs (search + filters)    |
 * | POST   | /jobs      | createJob                      |
 * | GET    | /jobs/:id  | getJobById                     |
 * | PUT    | /jobs/:id  | updateJob                      |
 * | DELETE | /jobs/:id  | deleteJob                      |
 *
 * Every handler is wrapped in asyncHandler so a rejected promise becomes a
 * proper JSON error response instead of a hanging request.
 */

const express = require('express');

const jobController = require('../controllers/jobController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router
  .route('/')
  .get(asyncHandler(jobController.listJobs))
  .post(asyncHandler(jobController.createJob));

router
  .route('/:id')
  .get(asyncHandler(jobController.getJobById))
  .put(asyncHandler(jobController.updateJob))
  .delete(asyncHandler(jobController.deleteJob));

module.exports = router;
