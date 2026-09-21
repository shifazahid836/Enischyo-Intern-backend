/**
 * models/Comment.js — Mongoose model for comments on a blog post.
 *
 * `postId` is the NUMERIC id of the parent post (not a Mongo ObjectId) so the
 * nested route /posts/:postId/comments keeps behaving exactly as before.
 * data/comments.js is no longer used — this collection is the source of truth.
 */

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    // Numeric id of the parent post (see models/Post.js)
    postId: {
      type: Number,
      required: [true, 'postId is required.'],
      index: true,
    },

    author: {
      type: String,
      trim: true,
      default: 'Anonymous',
      maxlength: [80, 'Author cannot be longer than 80 characters.'],
    },

    body: {
      type: String,
      required: [true, 'Comment body is required.'],
      trim: true,
      minlength: [1, 'Comment body cannot be empty.'],
      maxlength: [2000, 'Comment body cannot be longer than 2000 characters.'],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // The old API only exposed createdAt for comments, so no updatedAt here.
    timestamps: false,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        return ret;
      },
    },
  }
);

/**
 * @returns {Promise<number>} next free numeric comment id
 */
commentSchema.statics.nextId = async function nextId() {
  const lastComment = await this.findOne().sort({ id: -1 }).select('id').lean();
  return lastComment ? lastComment.id + 1 : 1;
};

module.exports = mongoose.model('Comment', commentSchema);
