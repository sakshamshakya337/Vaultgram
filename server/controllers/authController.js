'use strict';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: process.env.JWT_EXPIRY || '7d',
  });
};

/**
 * POST /api/v1/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const cleanUsername = (username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ message: 'Please provide username, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    }).select('+password');

    if (existingUser) {
      // If legacy document exists without a password, allow completing registration
      if (!existingUser.password) {
        existingUser.username = cleanUsername;
        existingUser.email = cleanEmail;
        existingUser.password = password; // Will be hashed by pre('save')
        await existingUser.save();

        const token = generateToken(existingUser._id);
        return res.status(200).json({
          token,
          user: {
            id: existingUser._id,
            username: existingUser.username,
            email: existingUser.email,
            role: existingUser.role,
            avatar: existingUser.avatar,
          },
        });
      }

      return res.status(400).json({
        message: existingUser.email === cleanEmail
          ? 'An account with this email already exists. Please Sign In.'
          : 'This username is already taken. Please choose another.',
      });
    }

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('[register error]:', err.message);
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
};

/**
 * POST /api/v1/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const identifier = (email || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please provide email/username and password' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'No account found with this email or username. Please click Create Account to sign up.' });
    }

    if (!user.password) {
      return res.status(401).json({ message: 'Account needs a password setup. Please click Create Account to set your password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please check your password and try again.' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('[login error]:', err.message);
    res.status(500).json({ message: err.message || 'Login failed' });
  }
};

/**
 * GET /api/v1/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('[getMe error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve profile' });
  }
};
