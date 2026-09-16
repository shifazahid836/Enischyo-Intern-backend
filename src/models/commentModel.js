/**
 * models/commentModel.js — data-access layer for comments.
 *
 * Same idea as postModel.js: the temporary array lives behind these
 * functions so it can be replaced by a Mongoose model later.
 */

const comments = require('../../data/comments');

// Auto-increment counter for new comments (simple substitute for Mongo's _id).
let nextId = comments.reduce((max, comment) => Math.max(max, comment.id), 0) + 1;

/**
 * @param {string|number} postId
 * @returns {object[]} every comment that belongs to the given post
 * Mongo: Comment.find({ postId })
 */
function findByPostId(postId) {
  const numericId = Number(postId);
  return comments.filter((comment) => comment.postId === numericId);
}

/**
 * @param {string|number} id
 * @returns {object|undefined} the comment, or undefined when it does not exist
 * Mongo: Comment.findById(id)
 */
function findById(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return undefined;
  return comments.find((comment) => comment.id === numericId);
}

/**
 * @param {{ postId: number, body: string, author?: string }} data
 * @returns {object} the newly created comment
 * Mongo: Comment.create(data)
 */
function create({ postId, body, author }) {
  const comment = {
    id: nextId,
    postId: Number(postId),
    author: author || 'Anonymous',
    body,
    createdAt: new Date().toISOString(),
  };

  nextId += 1;
  comments.push(comment);
  return comment;
}

/**
 * @param {string|number} id
 * @returns {object|null} the deleted comment, or null when it does not exist
 * Mongo: Comment.findByIdAndDelete(id)
 */
function remove(id) {
  const comment = findById(id);
  if (!comment) return null;

  const index = comments.indexOf(comment);
  comments.splice(index, 1);
  return comment;
}

/**
 * Deletes every comment belonging to a post. Used when a post is deleted so
 * that no orphan comments are left behind.
 * Mongo: Comment.deleteMany({ postId })
 *
 * @param {string|number} postId
 * @returns {number} how many comments were deleted
 */
function removeByPostId(postId) {
  const numericId = Number(postId);
  let deleted = 0;

  for (let i = comments.length - 1; i >= 0; i -= 1) {
    if (comments[i].postId === numericId) {
      comments.splice(i, 1);
      deleted += 1;
    }
  }

  return deleted;
}

module.exports = {
  findByPostId,
  findById,
  create,
  remove,
  removeByPostId,
};
