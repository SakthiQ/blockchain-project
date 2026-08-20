const mongoose = require('mongoose');

const DisputeSchema = new mongoose.Schema({
  disputeId: {
    type: Number,
    required: true,
    unique: true,
  },
  projectId: {
    type: Number,
    required: true,
  },
  raisedBy: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Resolved', 'Rejected'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Dispute', DisputeSchema);
