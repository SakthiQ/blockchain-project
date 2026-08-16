const mongoose = require('mongoose');

/**
 * User Model
 *
 * Stores platform user accounts. Passwords are never stored in plain text —
 * bcryptjs hashes them with 10 salt rounds before saving.
 *
 * Roles:
 *   - participant : Can submit project applications and raise disputes
 *   - judge       : Can commit and reveal scores for projects
 *   - admin       : Full governance access — phase control, approvals, dispute resolution
 */
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
  },
  role: {
    type: String,
    enum: ['participant', 'judge', 'admin'],
    default: 'participant',
  },
  walletAddress: {
    type: String,
    trim: true,
    default: '',
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);
