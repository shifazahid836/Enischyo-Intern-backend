/**
 * data/posts.js — temporary in-memory "database" for posts.
 *
 * This is a plain JavaScript array. When MongoDB is added in a later task,
 * only the model layer (src/models/postModel.js) has to change — the
 * controllers and routes stay exactly the same.
 *
 * Field shape (kept close to a Mongo document on purpose):
 *   id        → Number (will become _id in MongoDB)
 *   title     → String
 *   body      → String
 *   author    → String
 *   createdAt → ISO date string
 *   updatedAt → ISO date string
 */

const posts = [
  {
    id: 1,
    title: 'Getting Started with Node.js',
    body: 'Node.js lets you run JavaScript outside the browser. In this post we set up a first project, create a package.json file and run a hello-world script with npm.',
    author: 'Aarav Sharma',
    createdAt: '2026-01-05T09:00:00.000Z',
    updatedAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: 2,
    title: 'Understanding Express Middleware',
    body: 'Middleware functions are the backbone of an Express application. Each one receives the request, can modify it, and decides whether to continue the chain or send a response. This post walks through logging, validation and error middleware.',
    author: 'Priya Nair',
    createdAt: '2026-01-08T10:30:00.000Z',
    updatedAt: '2026-01-08T10:30:00.000Z',
  },
  {
    id: 3,
    title: 'REST API Design Basics',
    body: 'Good REST APIs use nouns for resources, HTTP verbs for actions and meaningful status codes. We compare 200, 201, 400, 404 and 500 and explain when each one should be returned.',
    author: 'Rahul Verma',
    createdAt: '2026-01-12T08:15:00.000Z',
    updatedAt: '2026-01-12T08:15:00.000Z',
  },
  {
    id: 4,
    title: 'Building a React Frontend with Vite',
    body: 'Vite gives React projects a very fast development server. We scaffold an app, add react-router-dom for navigation and split the UI into reusable components.',
    author: 'Sneha Iyer',
    createdAt: '2026-01-16T14:45:00.000Z',
    updatedAt: '2026-01-16T14:45:00.000Z',
  },
  {
    id: 5,
    title: 'Why Environment Variables Matter',
    body: 'Ports, database URLs and API keys should never live in source code. dotenv loads them from a .env file, and that file stays out of version control.',
    author: 'Karan Mehta',
    createdAt: '2026-01-20T11:20:00.000Z',
    updatedAt: '2026-01-20T11:20:00.000Z',
  },
  {
    id: 6,
    title: 'Pagination Explained for Beginners',
    body: 'Returning every record in a single response does not scale. Page and limit parameters let the client fetch small chunks of data, and the API returns metadata such as currentPage and totalPages.',
    author: 'Divya Rao',
    createdAt: '2026-01-24T16:05:00.000Z',
    updatedAt: '2026-01-24T16:05:00.000Z',
  },
  {
    id: 7,
    title: 'Validating Request Bodies in Express',
    body: 'Validation middleware keeps controllers clean. It rejects empty titles or bodies with a 400 response before any business logic runs.',
    author: 'Vikram Singh',
    createdAt: '2026-01-28T09:40:00.000Z',
    updatedAt: '2026-01-28T09:40:00.000Z',
  },
  {
    id: 8,
    title: 'Centralised Error Handling',
    body: 'A single error handler at the end of the middleware chain produces consistent JSON errors instead of HTML stack traces, and hides internal details in production.',
    author: 'Meera Krishnan',
    createdAt: '2026-02-02T12:10:00.000Z',
    updatedAt: '2026-02-02T12:10:00.000Z',
  },
  {
    id: 9,
    title: 'Logging Requests with Morgan',
    body: 'morgan prints one line per request with the method, path, status code and response time, which makes debugging API behaviour much faster.',
    author: 'Arjun Patel',
    createdAt: '2026-02-06T15:35:00.000Z',
    updatedAt: '2026-02-06T15:35:00.000Z',
  },
  {
    id: 10,
    title: 'Testing APIs with Postman',
    body: 'Postman collections group requests per resource so the whole API can be checked in seconds. Variables, environments and test scripts make the checks repeatable.',
    author: 'Nisha Gupta',
    createdAt: '2026-02-10T10:00:00.000Z',
    updatedAt: '2026-02-10T10:00:00.000Z',
  },
  {
    id: 11,
    title: 'From In-Memory Arrays to MongoDB',
    body: 'Arrays are perfect for learning the request/response cycle. When real persistence is needed, the model functions are re-implemented with Mongoose while the routes and controllers remain untouched.',
    author: 'Rohit Desai',
    createdAt: '2026-02-14T13:25:00.000Z',
    updatedAt: '2026-02-14T13:25:00.000Z',
  },
  {
    id: 12,
    title: 'Preparing a Project for GitHub',
    body: 'A repository should include source code, a lock file, a README and a .gitignore. Dependency folders and secret .env files must never be committed.',
    author: 'Ananya Bose',
    createdAt: '2026-02-18T17:50:00.000Z',
    updatedAt: '2026-02-18T17:50:00.000Z',
  },
];

module.exports = posts;
