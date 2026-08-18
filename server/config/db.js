'use strict';
const mongoose = require('mongoose');

let connectionPromise = null;

/**
 * Connects to MongoDB Atlas with robust reconnection, pooling, and command buffering.
 */
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }

  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 20000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 20000,
    })
    .then((m) => {
      console.log('✅ Connected to MongoDB Atlas');
      return m.connection;
    })
    .catch((err) => {
      connectionPromise = null;
      console.error('❌ MongoDB connection error:', err.message);
      throw err;
    });

  return connectionPromise;
}

/**
 * Express middleware to ensure database connection is ready before handling requests.
 */
const dbMiddleware = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database middleware connection failure:', err.message);
    return res.status(503).json({
      message: 'Database is connecting. Please retry in a few seconds.',
      error: err.message,
    });
  }
};

module.exports = { connectDB, dbMiddleware };
