const mongoose = require('mongoose');

const ProjectApplicationSchema = new mongoose.Schema({
  applicationId: {
    type: Number,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  teamLead: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    default: 'DeFi',
  },
  ipfsCID: {
    type: String,
    default: '',
  },
  applicantWallet: {
    type: String,
    required: true,
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
