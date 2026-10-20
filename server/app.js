'use strict';
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { connectDB, dbMiddleware } = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimiter');

// Route imports
const authRoutes = require('./routes/authRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const streamRoutes = require('./routes/streamRoutes');
const shareRoutes = require('./routes/shareRoutes');

const { autoPurgeOldTrash } = require('./controllers/mediaController');

const app = express();

// Trust reverse proxy headers on Render/Vercel/Heroku
app.set('trust proxy', 1);

// Initialize DB connection in background & run 30-day auto-purge
connectDB()
  .then(() => {
    autoPurgeOldTrash().catch(() => {});
    setInterval(() => {
      autoPurgeOldTrash().catch(() => {});
    }, 24 * 60 * 60 * 1000);
  })
  .catch((err) => {
    console.warn('Initial MongoDB connection note:', err.message);
  });

// Security & utility middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration supporting dynamic ALLOWED_ORIGIN env variable (auto-strips trailing slashes)
const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '*';
const allowedOrigins = allowedOriginEnv
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOriginEnv === '*' ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder', 'Range', 'x-vault-token', 'x-upload-vault'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type', 'Content-Disposition'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(generalLimiter);

// Health checks (lightweight, zero-DB ping for uptime monitors)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'Personal Storage API', timestamp: Date.now() });
});
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Personal Storage API',
    timestamp: Date.now(),
    version: '1.0.0',
  });
});
app.get('/api/v1/health/telegram', async (_req, res) => {
  try {
    const { testTelegramConnection } = require('./services/telegramService');
    const result = await testTelegramConnection();
    res.status(result.ok ? 200 : 502).json({
      status: result.ok ? 'connected' : 'error',
      ...result,
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message, timestamp: Date.now() });
  }
});

// Enforce DB connectivity for all API routes
app.use('/api/v1/auth', dbMiddleware, authRoutes);
app.use('/api/auth', dbMiddleware, authRoutes);

app.use('/api/v1/media', dbMiddleware, mediaRoutes);
app.use('/api/media', dbMiddleware, mediaRoutes);

app.use('/api/v1/videos', dbMiddleware, mediaRoutes);
app.use('/api/videos', dbMiddleware, mediaRoutes);

app.use('/api/v1/files', dbMiddleware, mediaRoutes);
app.use('/api/files', dbMiddleware, mediaRoutes);

app.use('/api/v1/share', dbMiddleware, shareRoutes);
app.use('/api/share', dbMiddleware, shareRoutes);
app.use('/share', dbMiddleware, shareRoutes);

app.use('/api/v1/stream', dbMiddleware, streamRoutes);
app.use('/api/stream', dbMiddleware, streamRoutes);
app.use('/stream', dbMiddleware, streamRoutes);

// 404 handler for all unmatched API and stream routes (ensures JSON responses, never HTML)
app.use(['/api', '/api/*', '/stream', '/stream/*', '/share', '/share/*'], (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'API route not found',
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[GlobalError]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
