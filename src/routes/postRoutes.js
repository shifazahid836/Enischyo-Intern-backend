/**
 * routes/postRoutes.js — URL definitions for the /posts resource.
 *
 * Routes stay "thin": they only map method + path to controller functions
 * (plus any validation middleware that must run first).
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
 */

const express = require('express');

const postController = require('../controllers/postController');
const commentRoutes = require('./commentRoutes');
const { validatePost } = require('../middleware/validation');

const router = express.Router();

// --- Nested comment routes: /posts/:postId/comments --------------------------
// Mounted first so the nested router owns those paths.
router.use('/:postId/comments', commentRoutes);

// --- Post CRUD ---------------------------------------------------------------
router
  .route('/')
  .get(postController.getPosts)
  .post(validatePost, postController.createPost);

router
  .route('/:id')
  .get(postController.getPostById)
  .put(validatePost, postController.updatePost)
  .delete(postController.deletePost);

module.exports = router;
