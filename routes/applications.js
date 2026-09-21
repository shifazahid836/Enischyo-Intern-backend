/**
 * routes/applications.js — URL definitions for /applications.
 *
 * | Method | Path                | Handler                |
 * |--------|---------------------|------------------------|
 * | GET    | /applications       | listApplications       |
 * | POST   | /applications       | createApplication      |
 * | GET    | /applications/:id   | getApplicationById     |
 * | PUT    | /applications/:id   | updateApplication      |
 * | DELETE | /applications/:id   | deleteApplication      |
 */

const express = require('express');

const applicationController = require('../controllers/applicationController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router
  .route('/')
  .get(asyncHandler(applicationController.listApplications))
  .post(asyncHandler(applicationController.createApplication));

router
  .route('/:id')
  .get(asyncHandler(applicationController.getApplicationById))
  .put(asyncHandler(applicationController.updateApplication))
  .delete(asyncHandler(applicationController.deleteApplication));

module.exports = router;
