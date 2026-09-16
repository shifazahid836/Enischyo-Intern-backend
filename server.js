/**
 * server.js — application entry point.
 *
 * Responsibilities (kept intentionally small):
 *   1. Load environment variables from .env
 *   2. Import the configured Express app (see src/app.js)
 *   3. Start listening on the configured port
 *
 * Run with:  npm run dev    (nodemon, auto-restart)
 *            npm start      (plain node)
 */

// Load .env variables BEFORE anything else reads process.env
require('dotenv').config();

const app = require('./src/app');

// Never hard-code the port: fall back to 5000 only if .env is missing PORT
const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
  console.log('------------------------------------------------------------');
  console.log('🚀  Blog API is running');
  console.log(`    Mode:        ${NODE_ENV}`);
  console.log(`    Base URL:    http://localhost:${PORT}`);
  console.log(`    Posts:       http://localhost:${PORT}/posts`);
  console.log(`    Health:      http://localhost:${PORT}/api/health`);
  console.log('    Stop server: Ctrl + C');
  console.log('------------------------------------------------------------');
});

// ---------------------------------------------------------------------------
// Friendly handling of "port already in use" (EADDRINUSE)
// A port can only be used by ONE process, so starting the server twice
// (for example two terminals running `npm run dev`) causes this error.
// ---------------------------------------------------------------------------
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('------------------------------------------------------------');
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error('   Another copy of this server (or another program) is using it.');
    console.error('');
    console.error('   How to fix it (pick one):');
    console.error('     1. Stop the other server  → press Ctrl + C in that terminal');
    console.error('     2. Use a different port   → set PORT=5001 in backend/.env');
    console.error('     3. Find the process using the port (Windows):');
    console.error(`        netstat -ano | findstr :${PORT}`);
    console.error('        taskkill /PID <pid> /F');
    console.error('------------------------------------------------------------');
    process.exit(1);
  }

  console.error('❌ Server error:', error.message);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Safety nets for unexpected failures (keeps the API from dying silently)
// ---------------------------------------------------------------------------

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  server.close(() => process.exit(1));
});

module.exports = server;
