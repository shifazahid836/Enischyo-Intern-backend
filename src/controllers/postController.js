/**
 * controllers/postController.js — request handlers for the /posts resource.
 *
 * Controllers only orchestrate: read the request, call the model, send JSON.
 * No data storage details and no route definitions live here.
 *
 * Every response uses the same envelope:
 *   success: true  → happy path
 *   success: false → error (see middleware/errorHandler.js)
 */

const postModel = require('../models/postModel');
const commentModel = require('../models/commentModel');

// Fixed page size required by the task spec
const POSTS_PER_PAGE = 10;

/**
 * Converts the ?page= query parameter to a safe positive integer.
 * Anything invalid ("abc", "0", "-3", missing) falls back to page 1.
 *
 * @param {unknown} value
 * @returns {number}
 */
function parsePage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * GET /posts  (and GET /posts?page=1)
 *
 * Returns 10 posts per page plus pagination metadata.
 */
function getPosts(req, res) {
  const requestedPage = parsePage(req.query.page);
  const { posts, total, totalPages } = postModel.findPage(requestedPage, POSTS_PER_PAGE);

  return res.status(200).json({
    success: true,
    currentPage: requestedPage,
    totalPosts: total,
    totalPages,
    postsPerPage: POSTS_PER_PAGE,
    count: posts.length,
    hasNextPage: requestedPage < totalPages,
    hasPrevPage: requestedPage > 1,
    posts,
  });
}

/**
 * GET /posts/:id
 * 404 when the post does not exist.
 */
function getPostById(req, res) {
  const post = postModel.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: `Post with id ${req.params.id} not found.`,
    });
  }

  return res.status(200).json({ success: true, post });
}

/**
 * POST /posts
 * Body is already validated (title + body) by middleware/validation.js.
 * Returns 201 Created with the new post.
 */
function createPost(req, res) {
  const post = postModel.create(req.body);

  return res.status(201).json({
    success: true,
    message: 'Post created successfully.',
    post,
  });
}

/**
 * PUT /posts/:id
 * Body is already validated by middleware/validation.js.
 * 404 when the post does not exist.
 */
function updatePost(req, res) {
  const post = postModel.update(req.params.id, req.body);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: `Post with id ${req.params.id} not found.`,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Post updated successfully.',
    post,
  });
}

/**
 * DELETE /posts/:id
 * Also removes the comments that belong to the post (no orphans).
 * 404 when the post does not exist.
 */
function deletePost(req, res) {
  // Check existence FIRST so a 404 never modifies any data
  const post = postModel.findById(req.params.id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: `Post with id ${req.params.id} not found.`,
    });
  }

  const deletedComments = commentModel.removeByPostId(post.id);
  postModel.remove(post.id);

  return res.status(200).json({
    success: true,
    message: 'Post deleted successfully.',
    deletedPost: post,
    deletedComments,
  });
}

module.exports = {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  POSTS_PER_PAGE,
};
