const mongoose = require('mongoose');

/**
 * ProjectApplication Model
 *
 * Tracks team self-registration applications submitted via
 * submitProjectApplication() on-chain. When admin approves an application,
 * the on-chain approveProjectApplication() is called and the project is
 * automatically registered. This MongoDB document mirrors that lifecycle.
 *
 * Status transitions:
 *   Pending → Approved  (admin approves → project auto-registered on-chain)
 *   Pending → Rejected  (admin rejects  → application closed)
 */
const ProjectApplicationSchema = new mongoose.Schema({
  applicationId: {
    type: Number,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    maxlength: 2000,
  },
  teamLead: {
    type: String,
    required: [true, 'Team lead name is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: ['DeFi', 'NFT', 'DAO', 'Infrastructure', 'Gaming', 'AI', 'Other'],
    default: 'DeFi',
  },
  ipfsCID: {
    type: String,
    default: '',
    trim: true,
  },
  applicantWallet: {
    type: String,
    required: [true, 'Applicant wallet address is required'],
    trim: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  registeredProjectId: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ProjectApplication', ProjectApplicationSchema);
