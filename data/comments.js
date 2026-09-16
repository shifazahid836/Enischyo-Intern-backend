/**
 * data/comments.js — temporary in-memory "database" for comments.
 *
 * Every comment belongs to exactly one post through the postId field.
 *
 * Field shape (kept close to a Mongo document on purpose):
 *   id        → Number (will become _id in MongoDB)
 *   postId    → Number (reference to posts.id)
 *   author    → String
 *   body      → String
 *   createdAt → ISO date string
 */

const comments = [
  {
    id: 1,
    postId: 1,
    author: 'Priya Nair',
    body: 'Great introduction, the npm setup steps worked for me on the first try.',
    createdAt: '2026-01-05T12:30:00.000Z',
  },
  {
    id: 2,
    postId: 1,
    author: 'Karan Mehta',
    body: 'Could you write a follow-up about the built-in http module?',
    createdAt: '2026-01-06T08:05:00.000Z',
  },
  {
    id: 3,
    postId: 2,
    author: 'Rahul Verma',
    body: 'The order of middleware was the part I always got wrong. This cleared it up.',
    createdAt: '2026-01-09T09:15:00.000Z',
  },
  {
    id: 4,
    postId: 3,
    author: 'Sneha Iyer',
    body: 'Nice summary of status codes. 201 vs 200 finally makes sense.',
    createdAt: '2026-01-13T11:45:00.000Z',
  },
  {
    id: 5,
    postId: 6,
    author: 'Vikram Singh',
    body: 'Pagination metadata is such a useful detail. Thanks for including totalPages.',
    createdAt: '2026-01-25T07:20:00.000Z',
  },
  {
    id: 6,
    postId: 12,
    author: 'Divya Rao',
    body: 'Reminder to add .env to .gitignore before the first push — saved me a lot of trouble.',
    createdAt: '2026-02-19T10:10:00.000Z',
  },
];

module.exports = comments;
