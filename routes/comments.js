/**
 * routes/comments.js — URL definitions for the comment resource.
 *
 * The same router is mounted in two places by app.js:
 *   1. /posts/:postId/comments  → GET all, POST create
 *   2. /comments                → DELETE /comments/:id
 *
 * `mergeParams: true` is required so this router can read the :postId
 * parameter that belongs to the parent (/posts) route.
 *
 * | Method | Path                    | Handler            |
 * |--------|-------------------------|--------------------|
 * | GET    | /posts/:postId/comments | getCommentsByPost  |
 * | POST   | /posts/:postId/comments | createComment      |
 * | DELETE | /comments/:id           | deleteComment      |
 */

const express = require('express');

const commentController = require('../controllers/commentController');
const { validateComment } = require('../middleware/validation');
const asyncHandler = require('../utils/asyncHandler');
const { protect, authorize } = require('../middleware/auth');

// `mergeParams` keeps :postId available when mounted under /posts/:postId
const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(asyncHandler(commentController.getCommentsByPost))
  .post(validateComment, asyncHandler(commentController.createComment));

// Deleting any resource is an admin action ("only admins can delete any resource").
router
  .route('/:id')
  .delete(protect, authorize('admin'), asyncHandler(commentController.deleteComment));

module.exports = router;
