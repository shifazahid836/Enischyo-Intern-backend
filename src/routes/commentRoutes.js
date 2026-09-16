/**
 * routes/commentRoutes.js — URL definitions for the comment resource.
 *
 * The same router is mounted in two places by src/app.js:
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

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(commentController.getCommentsByPost)
  .post(validateComment, commentController.createComment);

router.route('/:id').delete(commentController.deleteComment);

module.exports = router;
