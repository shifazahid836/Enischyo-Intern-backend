/**
 * models/Post.js — Mongoose model for blog posts (the original Task 2 API).
 *
 * The public API used to expose plain arrays with a NUMERIC id (/posts/1,
 * /posts/2 …). That contract is kept on purpose so the existing frontend /
 * Postman collection keeps working: the numeric `id` is a real schema field
 * and Mongo's `_id` stays internal.
 *
 * The in-memory array in data/posts.js is gone — this collection is now the
 * single source of truth.
 */

const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    // Public identifier, still an incrementing number (see nextId() below)
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
      minlength: [1, 'Title cannot be empty.'],
      maxlength: [200, 'Title cannot be longer than 200 characters.'],
    },

    body: {
      type: String,
      required: [true, 'Body is required.'],
      trim: true,
      minlength: [1, 'Body cannot be empty.'],
      maxlength: [10000, 'Body cannot be longer than 10000 characters.'],
    },

    author: {
      type: String,
      trim: true,
      default: 'Anonymous',
      maxlength: [80, 'Author cannot be longer than 80 characters.'],
    },
  },
  {
    timestamps: true, // createdAt + updatedAt, exactly like the old array
    versionKey: false,
    toJSON: {
      // Keep the response shape identical to the pre-Mongo version
      transform(doc, ret) {
        delete ret._id;
        return ret;
      },
    },
  }
);

/**
 * Next free numeric id (highest id + 1).
 *
 * Mongo's ObjectId is perfect for the new job-board collections, but the blog
 * API promised numeric ids, so we generate them ourselves.
 *
 * @returns {Promise<number>}
 */
postSchema.statics.nextId = async function nextId() {
  const lastPost = await this.findOne().sort({ id: -1 }).select('id').lean();
  return lastPost ? lastPost.id + 1 : 1;
};

module.exports = mongoose.model('Post', postSchema);
