/**
 * controllers/commentController.js — request handlers for comments.
 *
 * Routes this controller answers:
 *   GET    /posts/:postId/comments   → getCommentsByPost
 *   POST   /posts/:postId/comments   → createComment
 *   DELETE /comments/:id             → deleteComment
 *
 * (The :postId parameter comes from the parent route, which is why the
 * comment router is created with { mergeParams: true }.)
 */

const commentModel = require('../models/commentModel');
const postModel = require('../models/postModel');

/**
 * Builds the 404 response used when the parent post is missing.
 * Also covers a malformed call such as GET /comments where no post id exists.
 *
 * @param {import('express').Response} res
 * @param {string|number|undefined} postId
 */
function sendPostNotFound(res, postId) {
  return res.status(404).json({
    success: false,
    message:
      postId === undefined
        ? 'Post id is required. Use /posts/:postId/comments.'
        : `Post with id ${postId} not found.`,
  });
}

/**
 * GET /posts/:postId/comments
 * 404 when the parent post does not exist.
 */
function getCommentsByPost(req, res) {
  const post = postModel.findById(req.params.postId);

  if (!post) {
    return sendPostNotFound(res, req.params.postId);
  }

  const comments = commentModel.findByPostId(req.params.postId);

  return res.status(200).json({
    success: true,
    postId: post.id,
    totalComments: comments.length,
    comments,
  });
}

/**
 * POST /posts/:postId/comments
 * Body is already validated (comment body) by middleware/validation.js.
 * 404 when the parent post does not exist, 201 when the comment is created.
 */
function createComment(req, res) {
  const post = postModel.findById(req.params.postId);

  if (!post) {
    return sendPostNotFound(res, req.params.postId);
  }

  const comment = commentModel.create({
    postId: post.id,
    body: req.body.body,
    author: req.body.author,
  });

  return res.status(201).json({
    success: true,
    message: 'Comment added successfully.',
    comment,
  });
}

/**
 * DELETE /comments/:id
 * 404 when the comment does not exist.
 */
function deleteComment(req, res) {
  const comment = commentModel.remove(req.params.id);

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: `Comment with id ${req.params.id} not found.`,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Comment deleted successfully.',
    deletedComment: comment,
  });
}

module.exports = {
  getCommentsByPost,
  createComment,
  deleteComment,
};
