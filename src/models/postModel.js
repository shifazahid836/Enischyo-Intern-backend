/**
 * models/postModel.js — data-access layer for posts.
 *
 * EVERYTHING that touches the temporary in-memory array lives here.
 * Controllers never touch the array directly, so swapping this file for
 * Mongoose models later is the only change required.
 *
 * Mongo equivalent of each function is noted in the comments.
 */

const posts = require('../../data/posts');

// Auto-increment counter for new posts (simple substitute for Mongo's _id).
let nextId = posts.reduce((max, post) => Math.max(max, post.id), 0) + 1;

/**
 * @returns {number} total number of posts
 * Mongo: Post.countDocuments()
 */
function count() {
  return posts.length;
}

/**
 * @param {number} page  1-based page number
 * @param {number} limit number of posts per page
 * @returns {{ posts: object[], total: number, totalPages: number }}
 * Mongo: Post.find().skip((page - 1) * limit).limit(limit)
 */
function findPage(page, limit) {
  const start = (page - 1) * limit;
  return {
    posts: posts.slice(start, start + limit),
    total: posts.length,
    totalPages: Math.ceil(posts.length / limit),
  };
}

/**
 * @param {string|number} id
 * @returns {object|undefined} the post, or undefined when it does not exist
 * Mongo: Post.findById(id)
 */
function findById(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return undefined;
  return posts.find((post) => post.id === numericId);
}

/**
 * @param {{ title: string, body: string, author?: string }} data
 * @returns {object} the newly created post
 * Mongo: Post.create(data)
 */
function create({ title, body, author }) {
  const now = new Date().toISOString();
  const post = {
    id: nextId,
    title,
    body,
    author: author || 'Anonymous',
    createdAt: now,
    updatedAt: now,
  };

  nextId += 1;
  posts.push(post);
  return post;
}

/**
 * @param {string|number} id
 * @param {{ title?: string, body?: string, author?: string }} changes
 * @returns {object|null} the updated post, or null when it does not exist
 * Mongo: Post.findByIdAndUpdate(id, changes, { new: true })
 */
function update(id, changes) {
  const post = findById(id);
  if (!post) return null;

  if (typeof changes.title === 'string') post.title = changes.title.trim();
  if (typeof changes.body === 'string') post.body = changes.body.trim();
  if (typeof changes.author === 'string' && changes.author.trim()) {
    post.author = changes.author.trim();
  }
  post.updatedAt = new Date().toISOString();

  return post;
}

/**
 * @param {string|number} id
 * @returns {object|null} the deleted post, or null when it does not exist
 * Mongo: Post.findByIdAndDelete(id)
 */
function remove(id) {
  const post = findById(id);
  if (!post) return null;

  const index = posts.indexOf(post);
  posts.splice(index, 1);
  return post;
}

module.exports = {
  count,
  findPage,
  findById,
  create,
  update,
  remove,
};
