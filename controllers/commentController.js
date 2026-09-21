/**
 * controllers/commentController.js — request handlers for comments.
 *
 * MIGRATED TO MONGODB: comments are now documents in the "comments"
 * collection instead of rows in an in-memory array.
 *
 * Routes this controller answers:
 *   GET    /posts/:postId/comments   → getCommentsByPost
 *   POST   /posts/:postId/comments   → createComment
 *   DELETE /comments/:id             → deleteComment
 *
 * (:postId comes from the parent route, which is why the comment router is
 * created with { mergeParams: true }.)
 */

const Post = require('../models/Post');
const Comment = require('../models/Comment');

/**
 * The blog API uses numeric ids, so "abc" can never be a valid id.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function parseNumericId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

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
async function getCommentsByPost(req, res) {
  const postId = parseNumericId(req.params.postId);
  const post = postId === null ? null : await Post.findOne({ id: postId });

  if (!post) {
    return sendPostNotFound(res, req.params.postId);
  }

  const comments = await Comment.find({ postId: post.id }).sort({ id: 1 });

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
async function createComment(req, res) {
  const postId = parseNumericId(req.params.postId);
  const post = postId === null ? null : await Post.findOne({ id: postId });

  if (!post) {
    return sendPostNotFound(res, req.params.postId);
  }

  const id = await Comment.nextId();

  const comment = await Comment.create({
    id,
    postId: post.id,
    body: req.body.body,
    author: req.body.author, // undefined → schema default "Anonymous"
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
async function deleteComment(req, res) {
  const commentId = parseNumericId(req.params.id);
  const comment = commentId === null ? null : await Comment.findOne({ id: commentId });

  if (!comment) {
    return res.status(404).json({
      success: false,
      message: `Comment with id ${req.params.id} not found.`,
    });
  }

  await comment.deleteOne();

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
