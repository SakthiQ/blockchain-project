const express = require('express');
const router = express.Router();
const Dispute = require('../models/Dispute');

// Get all disputes
router.get('/', async (req, res) => {
  try {
    const disputes = await Dispute.find().sort({ createdAt: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File new dispute appeal
router.post('/', async (req, res) => {
  try {
    const { projectId, raisedBy, reason } = req.body;

    if (!projectId || !raisedBy || !reason) {
      return res.status(400).json({ error: 'projectId, raisedBy, and reason are required.' });
    }

    const count = await Dispute.countDocuments();
    const newDisputeId = count + 1;

    const newDispute = new Dispute({
      disputeId: newDisputeId,
      projectId: Number(projectId),
      raisedBy,
      reason,
      status: 'Pending',
    });

    await newDispute.save();

    res.status(201).json({
      message: 'Dispute appeal filed successfully',
      dispute: newDispute,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update dispute status (Resolve / Reject)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Resolved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const d = await Dispute.findOne({ disputeId: Number(id) });
    if (!d) {
      return res.status(404).json({ error: 'Dispute not found.' });
    }

    d.status = status;
    await d.save();

    res.json({
      message: `Dispute #${id} set to ${status}`,
      dispute: d,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
