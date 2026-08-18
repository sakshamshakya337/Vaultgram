'use strict';
const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// General API limiter: 300 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 2000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Auth endpoints limiter (login/register): 30 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again after a minute.' },
});

// Streaming & media limiter: 1000 requests per minute
const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 10000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Stream request rate limit exceeded.' },
});

module.exports = {
  generalLimiter,
  authLimiter,
  streamLimiter,
};
