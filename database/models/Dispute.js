const mongoose = require('mongoose');

/**
 * Dispute Model
 *
 * Mirrors the on-chain Dispute struct in HackathonJudging.sol.
 * Every on-chain raiseDispute() call should have a corresponding
 * MongoDB document here providing the full reason text and audit trail.
 *
 * The on-chain pendingDisputeCount blocks setPhase(Finalized) until
 * all disputes are resolved. This off-chain document provides the
 * rich text context the admin needs to review each appeal.
 *
 * Status transitions:
 *   Pending → Resolved  (admin accepts the appeal)
 *   Pending → Rejected  (admin dismisses the appeal)
 */
const DisputeSchema = new mongoose.Schema({
  disputeId: {
    type: Number,
    required: true,
    unique: true,
  },
  projectId: {
    type: Number,
    required: [true, 'Project ID is required'],
  },
  raisedBy: {
    type: String,
    required: [true, 'Wallet address of disputing party is required'],
    trim: true,
  },
  reason: {
    type: String,
    required: [true, 'Dispute reason is required'],
    maxlength: 2000,
  },
  status: {
    type: String,
    enum: ['Pending', 'Resolved', 'Rejected'],
    default: 'Pending',
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Dispute', DisputeSchema);
