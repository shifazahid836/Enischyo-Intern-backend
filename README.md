# Blog API — Backend (Task 2)

A fully working **REST API for the blog platform**, built with **Node.js + Express.js**.
It implements complete CRUD for **posts** and **comments**, request validation,
centralised error handling, request logging with response times and pagination.

> 📦 **Data is stored in memory** (plain JavaScript arrays in `data/`).
> MongoDB is **not** part of this task — the model layer is written so it can be
> swapped for Mongoose later without touching routes or controllers
> (see [Swapping in MongoDB](#-swapping-in-mongodb-later)).

---

## 📖 Project overview

| Item | Value |
| --- | --- |
| Task | Task 2 — Backend API development |
| Purpose | Provide the REST API that the blog frontend will consume |
| Storage | In-memory JavaScript arrays (temporary, no database yet) |
| Page size | 10 posts per page |
| Base URL | `http://localhost:5000` |
| Available at | `http://localhost:5000/posts` **and** `http://localhost:5000/api/posts` |

---

## 🧰 Technologies used

| Technology | Why it is used |
| --- | --- |
| **Node.js** | JavaScript runtime for the server |
| **Express.js** | Routing and middleware framework for the API |
| **dotenv** | Loads configuration (like `PORT`) from a `.env` file |
| **morgan** | HTTP request logging (method, URL, status, response time) |
| **nodemon** | Development tool that restarts the server on file changes |
| **Postman** | Manual testing of every endpoint (collection included) |

---

## 📁 Project folder structure

```
backend/
├── data/                              # temporary "database" (plain arrays)
│   ├── posts.js                       #   12 sample posts
│   └── comments.js                    #   6 sample comments
├── src/
│   ├── controllers/                   # business logic per resource
│   │   ├── postController.js
│   │   └── commentController.js
│   ├── middleware/                    # reusable request pipeline pieces
│   │   ├── logger.js                  #   morgan + custom response-time logger
│   │   ├── validation.js              #   validates post/comment bodies
│   │   ├── errorHandler.js            #   404 handler + 500 error handler
│   │   └── cors.js                    #   allows the frontend dev server to call the API
│   ├── models/                        # data-access layer (MongoDB swap point)
│   │   ├── postModel.js
│   │   └── commentModel.js
│   ├── routes/                        # URL definitions, no business logic
│   │   ├── postRoutes.js
│   │   └── commentRoutes.js
│   └── app.js                         # express app: middleware + route mounting
├── postman/
│   └── Blog-API.postman_collection.json   # 30 ready-to-run requests
├── .env                               # local config (git-ignored)
├── .env.example                       # template committed to git
├── .gitignore
├── package.json
├── package-lock.json
├── server.js                          # entry point (loads .env, starts the server)
└── README.md
```

**Why this structure?** `server.js` only starts the process, `app.js` configures
Express, routes only map URLs to controllers, controllers hold the logic and
models own the data. Nothing but wiring lives in the entry file.

---

## ⚙️ Environment variables

`.env` (already present locally, **never committed**):

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*
```

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Port the API listens on | `5000` |
| `NODE_ENV` | `development` or `production` (production hides internal error details) | `development` |
| `CORS_ORIGIN` | Allowed browser origin(s) | `*` |

`.env.example` is committed so anyone cloning the repository knows what to set.
The port is **never hard-coded** — it always comes from the environment.

---

## 🚀 Installation & running the server

```bash
# 1. go to the backend folder
cd backend

# 2. install dependencies
npm install

# 3. create your .env file
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows (PowerShell / CMD)

# 4. start the server
npm run dev                 # nodemon (auto-restart, recommended while developing)
npm start                   # plain node
```

Expected console output:

```
------------------------------------------------------------
🚀  Blog API is running
    Mode:        development
    Base URL:    http://localhost:5000
    Posts:       http://localhost:5000/posts
    Health:      http://localhost:5000/api/health
    Stop server: Ctrl + C
------------------------------------------------------------
```

Quick check in a browser or Postman: `GET http://localhost:5000/api/health`

### npm scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm start` | `node server.js` | Run the server |
| `npm run dev` | `nodemon server.js` | Run and auto-restart on changes |

---

## 🔌 API endpoints

Routes are mounted **twice** — without and with the `/api` prefix (e.g. `/posts`
and `/api/posts`) — so the frontend proxy can use `/api` while the plain paths
also work.

### Posts

| Method | Endpoint | Description | Success |
| --- | --- | --- | --- |
| `GET` | `/posts` | All posts, paginated (10 per page) | `200` |
| `GET` | `/posts?page=2` | A specific page | `200` |
| `GET` | `/posts/:id` | One post by id | `200` / `404` |
| `POST` | `/posts` | Create a post | `201` / `400` |
| `PUT` | `/posts/:id` | Update a post | `200` / `400` / `404` |
| `DELETE` | `/posts/:id` | Delete a post (and its comments) | `200` / `404` |

### Comments

| Method | Endpoint | Description | Success |
| --- | --- | --- | --- |
| `GET` | `/posts/:id/comments` | All comments of a post | `200` / `404` |
| `POST` | `/posts/:id/comments` | Add a comment to a post | `201` / `400` / `404` |
| `DELETE` | `/comments/:id` | Delete a comment by id | `200` / `404` |

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` or `/api/health` | Server status, environment and timestamp |

### Status codes used

| Code | Meaning | When |
| --- | --- | --- |
| `200` | OK | Successful `GET`, `PUT`, `DELETE` |
| `201` | Created | Successful `POST` |
| `400` | Bad Request | Validation failed (missing/empty fields, malformed JSON) |
| `404` | Not Found | Missing post/comment, or unknown route |
| `500` | Internal Server Error | Unexpected failure (internal details hidden in production) |

---

## 📥 Example requests & responses

### 1. List posts with pagination

```http
GET /posts?page=1
```

```json
{
  "success": true,
  "currentPage": 1,
  "totalPosts": 12,
  "totalPages": 2,
  "postsPerPage": 10,
  "count": 10,
  "hasNextPage": true,
  "hasPrevPage": false,
  "posts": [
    {
      "id": 1,
      "title": "Getting Started with Node.js",
      "body": "Node.js lets you run JavaScript outside the browser...",
      "author": "Aarav Sharma",
      "createdAt": "2026-01-05T09:00:00.000Z",
      "updatedAt": "2026-01-05T09:00:00.000Z"
    }
  ]
}
```

* Page size is fixed at **10**. `?page=` may be omitted (defaults to page 1).
* An invalid value such as `?page=abc` or `?page=0` falls back to page 1.
* A page beyond the last one returns an empty `posts` array (`200`, no error).

### 2. Get one post — `GET /posts/1`

```json
{ "success": true, "post": { "id": 1, "title": "Getting Started with Node.js", "body": "...", "author": "Aarav Sharma" } }
```

Missing post → `404`:

```json
{ "success": false, "message": "Post with id 999 not found." }
```

### 3. Create a post — `POST /posts`

```json
{
  "title": "My First Post",
  "body": "This is my first blog post.",
  "author": "Optional Author"
}
```

→ `201 Created`

```json
{
  "success": true,
  "message": "Post created successfully.",
  "post": { "id": 13, "title": "My First Post", "body": "This is my first blog post.", "author": "Optional Author" }
}
```

### 4. Update a post — `PUT /posts/13`

```json
{ "title": "Updated title", "body": "Updated body." }
```

→ `200 OK` with `"message": "Post updated successfully."` and the updated post.

### 5. Delete a post — `DELETE /posts/13`

```json
{
  "success": true,
  "message": "Post deleted successfully.",
  "deletedPost": { "id": 13, "title": "Updated title" },
  "deletedComments": 2
}
```

### 6. Get comments of a post — `GET /posts/1/comments`

```json
{
  "success": true,
  "postId": 1,
  "totalComments": 2,
  "comments": [
    { "id": 1, "postId": 1, "author": "Priya Nair", "body": "Great introduction!" }
  ]
}
```

### 7. Add a comment — `POST /posts/1/comments`

```json
{ "author": "Optional Author", "body": "Great post!" }
```

→ `201 Created` with `"message": "Comment added successfully."`

### 8. Delete a comment — `DELETE /comments/1`

→ `200 OK` with `"message": "Comment deleted successfully."`

---

## ✅ Validation rules

Validation lives in `src/middleware/validation.js` and runs **before** the controller.

| Endpoint | Rule | Response |
| --- | --- | --- |
| `POST /posts`, `PUT /posts/:id` | `title` must be a non-empty string | `400` |
| `POST /posts`, `PUT /posts/:id` | `body` must be a non-empty string | `400` |
| `POST /posts/:id/comments` | `body` must be a non-empty string | `400` |
| any | malformed JSON payload | `400` |

Whitespace-only values (e.g. `"   "`) are treated as empty.

Error format:

```json
{
  "success": false,
  "message": "Title and body are required.",
  "errors": [
    "title is required and cannot be empty.",
    "body is required and cannot be empty."
  ]
}
```

Single missing field:

```json
{ "success": false, "message": "body is required and cannot be empty.", "errors": ["body is required and cannot be empty."] }
```

---

## 🪵 Request logging

`src/middleware/logger.js` provides two loggers that run on every request:

1. **morgan** (required dependency) — detailed HTTP line with the status code:
   `GET /posts 200 - 0.949 ms`
2. **custom `requestLogger`** — the concise line from the task spec, measured with
   the Node `finish` event:

```
GET /posts - 1.9ms
POST /posts - 8.4ms
PUT /posts/13 - 1.2ms
DELETE /comments/7 - 0.5ms
```

In production (`NODE_ENV=production`) morgan switches to the Apache-style
`combined` format.

---

## 🛡️ Error handling

* **404 handler** (`notFound`) — catches every unmatched route and answers with
  JSON instead of an HTML page:

  ```json
  { "success": false, "message": "Route not found", "method": "GET", "path": "/nope" }
  ```

* **500 handler** (`errorHandler`) — one place for every unexpected error:

  ```json
  { "success": false, "message": "Internal Server Error" }
  ```

  In non-production environments an extra `error` field with the real message is
  added for debugging; in production it is omitted so internals are never leaked.

* Both handlers are registered **last** in `src/app.js`, after all routes.

---

## 🧪 Testing with Postman

The collection `postman/Blog-API.postman_collection.json` contains **30 requests**
with automated assertions.

### Import the collection

1. Open Postman → **Import** (top-left) → **Files** → select
   `backend/postman/Blog-API.postman_collection.json`.
2. The collection **Blog API - Node.js + Express (Task 2)** appears in the sidebar.
3. Start the backend first: `npm run dev` inside `backend/`.
4. Check the collection variables (`baseUrl` = `http://localhost:5000`, `postId` = `1`)
   and change them if your server runs elsewhere.
5. Send requests individually, or right-click the collection → **Run collection**
   to execute everything (the *Posts* folder creates a post, updates it and then
   deletes it, so the requests are self-contained).

### Collection folders

| Folder | Contents |
| --- | --- |
| **Health Check** | `GET /api/health` |
| **Posts** | list (all / page 1 / page 2 / page 99), get by id, create, update, delete |
| **Comments** | comments of a post, create comment, delete comment, unsupported `GET /comments` |
| **Error Cases** | missing/empty/invalid **title** and **body**, invalid data types, malformed JSON, non-existing post & comment ids, unknown routes, unknown `/api` route |

Requests that create data store the new id in the `createdPostId` /
`createdCommentId` collection variables, which the follow-up `PUT` and `DELETE`
requests reuse automatically.

### Manual curl equivalent

```bash
curl http://localhost:5000/posts
curl "http://localhost:5000/posts?page=2"
curl http://localhost:5000/posts/1
curl -X POST http://localhost:5000/posts -H "Content-Type: application/json" -d "{\"title\":\"Hello\",\"body\":\"World\"}"
curl -X PUT http://localhost:5000/posts/1 -H "Content-Type: application/json" -d "{\"title\":\"Hi\",\"body\":\"Again\"}"
curl -X DELETE http://localhost:5000/posts/13
curl http://localhost:5000/posts/1/comments
curl -X POST http://localhost:5000/posts/1/comments -H "Content-Type: application/json" -d "{\"body\":\"Nice!\"}"
curl -X DELETE http://localhost:5000/comments/1
```

---

## 🗄️ Data (temporary, in-memory)

Sample data lives in `data/posts.js` (12 posts, so pagination is easy to see) and
`data/comments.js` (6 comments).

```js
// post
{ id: 1, title: 'My First Post', body: 'This is my first blog post.', author: 'Aarav Sharma', createdAt: '...', updatedAt: '...' }

// comment
{ id: 1, postId: 1, author: 'Priya Nair', body: 'Great post!', createdAt: '...' }
```

Because the data is in memory, **restarting the server resets everything** to the
seed values. New ids are generated by incrementing a counter inside the models.

---

## 🔄 Swapping in MongoDB later

Only `src/models/postModel.js` and `src/models/commentModel.js` need to change.
Each function documents its Mongo equivalent, for example:

| Current function | Mongo / Mongoose equivalent |
| --- | --- |
| `findById(id)` | `Post.findById(id)` |
| `findPage(page, limit)` | `Post.find().skip((page - 1) * limit).limit(limit)` |
| `create(data)` | `Post.create(data)` |
| `update(id, changes)` | `Post.findByIdAndUpdate(id, changes, { new: true })` |
| `remove(id)` | `Post.findByIdAndDelete(id)` |
| `removeByPostId(postId)` | `Comment.deleteMany({ postId })` |

Routes, controllers, validation and error handling stay exactly as they are.

---

## 🐙 Pushing to GitHub

Already GitHub-ready: `package.json`, `package-lock.json`, source code, Postman
collection, `README.md`, `.env.example` and `.gitignore` are committed, while
`node_modules/` and `.env` are **ignored**.

```bash
cd backend
git add .
git status     # node_modules and .env must NOT appear
git commit -m "Task 2: Blog REST API with Express"
git push
```

---

## 🆘 Troubleshooting

| Problem | Solution |
| --- | --- |
| `EADDRINUSE: address already in use :::5000` | Two servers cannot share one port. Press `Ctrl + C` in the other terminal that runs the API, or set another port in `.env`. On Windows, find and stop the process with `netstat -ano \| findstr :5000` then `taskkill /PID <pid> /F` |
| `Cannot find module 'express'` | Run `npm install` inside `backend/` |
| `nodemon is not recognized` | Use `npx nodemon server.js` or reinstall dev dependencies with `npm install` |
| All Postman requests fail to connect | The server is not running, or `baseUrl` points to the wrong port |
| Data "disappears" after a restart | Expected — the store is in memory; restarting reloads the seed data |

---

## 👣 Possible next steps

* Replace the arrays with MongoDB + Mongoose (Task 3 territory).
* Add a `User` resource with authentication (JWT) and protect write endpoints.
* Add automated tests (Jest + Supertest) and a CI workflow.
* Add query filtering (`?search=`, `?author=`) and sorting to `GET /posts`.

---

## 📄 License

MIT — free to use for learning purposes.

