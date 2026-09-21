/**
 * middleware/validation.js — reusable request-body validation.
 *
 * Both middlewares follow the same contract:
 *   ✅ valid   → req.body is normalised (trimmed strings) and next() is called
 *   ❌ invalid → HTTP 400 with a descriptive JSON error, chain stops
 *
 * Error shape (consistent across the whole API):
 *   { "success": false, "message": "...", "errors": ["..."] }
 */

/**
 * @param {unknown} value
 * @returns {boolean} true when value is a string containing real characters
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates the body of POST /posts and PUT /posts/:id.
 * - title is required and must not be empty
 * - body  is required and must not be empty
 * - author is optional (defaults to "Anonymous" in the model layer)
 */
function validatePost(req, res, next) {
  const { title, body, author } = req.body || {};

  const titleIsValid = isNonEmptyString(title);
  const bodyIsValid = isNonEmptyString(body);

  if (!titleIsValid || !bodyIsValid) {
    const errors = [];

    if (!titleIsValid) errors.push('title is required and cannot be empty.');
    if (!bodyIsValid) errors.push('body is required and cannot be empty.');

    // When both are missing, use the exact message from the task spec.
    const message =
      !titleIsValid && !bodyIsValid
        ? 'Title and body are required.'
        : errors.join(' ');

    return res.status(400).json({ success: false, message, errors });
  }

  if (author !== undefined && !isNonEmptyString(author)) {
    return res.status(400).json({
      success: false,
      message: 'Author must be a non-empty string when provided.',
      errors: ['author must be a non-empty string when provided.'],
    });
  }

  // Normalise the payload before it reaches the controller
  req.body = {
    title: title.trim(),
    body: body.trim(),
    ...(isNonEmptyString(author) ? { author: author.trim() } : {}),
  };

  return next();
}

/**
 * Validates the body of POST /posts/:id/comments.
 * - body is required and must not be empty
 * - author is optional (defaults to "Anonymous" in the model layer)
 */
function validateComment(req, res, next) {
  const { body, author } = req.body || {};

  if (!isNonEmptyString(body)) {
    return res.status(400).json({
      success: false,
      message: 'Comment body is required and cannot be empty.',
      errors: ['body is required and cannot be empty.'],
    });
  }

  if (author !== undefined && !isNonEmptyString(author)) {
    return res.status(400).json({
      success: false,
      message: 'Author must be a non-empty string when provided.',
      errors: ['author must be a non-empty string when provided.'],
    });
  }

  req.body = {
    body: body.trim(),
    ...(isNonEmptyString(author) ? { author: author.trim() } : {}),
  };

  return next();
}

module.exports = { validatePost, validateComment, isNonEmptyString };
