/**
 * routes/posts.js — URL definitions for the /posts resource.
 *
 * | Method | Path                    | Handler                       |
 * |--------|-------------------------|-------------------------------|
 * | GET    | /posts                  | getPosts (paginated)          |
 * | POST   | /posts                  | createPost                    |
 * | GET    | /posts/:id              | getPostById                   |
 * | PUT    | /posts/:id              | updatePost                    |
 * | DELETE | /posts/:id              | deletePost                    |
 * | GET    | /posts/:postId/comments | getCommentsByPost  (nested)   |
 * | POST   | /posts/:postId/comments | createComment      (nested)   |
 *
 * These endpoints now read and write MongoDB. asyncHandler makes sure a
 * rejected promise (for example "database down") reaches the error handler
 * instead of hanging the request.
 */

const express = require('express');

const postController = require('../controllers/postController');
const commentRoutes = require('./comments');
const { validatePost } = require('../middleware/validation');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// --- Nested comment routes: /posts/:postId/comments --------------------------
// Mounted first so the nested router owns those paths.
router.use('/:postId/comments', commentRoutes);

// --- Post CRUD ---------------------------------------------------------------
router
  .route('/')
  .get(asyncHandler(postController.getPosts))
  .post(validatePost, asyncHandler(postController.createPost));

router
  .route('/:id')
  .get(asyncHandler(postController.getPostById))
  .put(validatePost, asyncHandler(postController.updatePost))
  .delete(asyncHandler(postController.deletePost));

module.exports = router;
