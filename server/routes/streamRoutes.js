'use strict';
const router = require('express').Router();
const cors = require('cors');
const { streamMedia } = require('../controllers/streamController');
const { optionalAuth } = require('../middleware/auth');
const { streamLimiter } = require('../middleware/rateLimiter');

const streamCors = cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Range', 'Authorization', 'Content-Type', 'bypass-tunnel-reminder'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
});

router.options('/:id', streamCors, (_req, res) => res.sendStatus(204));
router.get('/:id', streamCors, streamLimiter, optionalAuth, streamMedia);

module.exports = router;
