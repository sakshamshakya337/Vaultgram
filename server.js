'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const app = require('./server/app');

const PORT = process.env.PORT || 5000;
const distPath = path.join(__dirname, 'dist');

// Serve static frontend build if dist folder exists
app.use(express.static(distPath));

// SPA fallback for frontend client-side routing
app.get('*', (req, res, next) => {
  // Pass through if request is for API routes or health
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      // In dev mode when dist is not yet built, return a simple notice
      res.status(200).send('Personal Storage API is running. Start the Vite dev server with `npm run dev` to view the UI.');
    }
  });
});

if (process.env.VERCEL !== '1') {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Personal Storage server running on http://localhost:${PORT}`);
    console.log(`   API Endpoint:    http://localhost:${PORT}/api/v1/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Retrying in 1s or terminate the conflicting process.`);
    } else {
      console.error('Server error:', err);
    }
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.once('SIGUSR2', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
