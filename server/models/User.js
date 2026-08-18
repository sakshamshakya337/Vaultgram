'use strict';
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    pinHash: {
      type: String,
      default: null,
      select: false,
    },
    lockedCategories: {
      type: [String],
      default: [],
    },
    biometricCredentials: [
      {
        credentialID: { type: String, required: true },
        publicKey: { type: String, required: true },
        counter: { type: Number, default: 0 },
        deviceLabel: { type: String, default: 'Biometric Authenticator' },
        transports: { type: [String], default: [] },
      },
    ],
    currentChallenge: {
      type: String,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!enteredPassword || !this.password) return false;
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (err) {
    console.error('comparePassword error:', err.message);
    return false;
  }
};

userSchema.methods.comparePin = async function (enteredPin) {
  if (!enteredPin || !this.pinHash) return false;
  try {
    return await bcrypt.compare(String(enteredPin), this.pinHash);
  } catch (err) {
    console.error('comparePin error:', err.message);
    return false;
  }
};

module.exports = mongoose.model('User', userSchema);
