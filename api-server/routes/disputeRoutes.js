const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const Dispute = require('../models/Dispute'); // Mongoose fallback

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/disputes — Return all disputes
// ──────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (supabaseService.isConfigured()) {
      const data = await supabaseService.getDisputes();
      return res.json(data || []);
    }
    const disputes = await Dispute.find().sort({ createdAt: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/disputes — File a new dispute appeal
// ──────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { projectId, raisedBy, reason } = req.body;

    if (!projectId || !raisedBy || !reason) {
      return res.status(400).json({ error: 'projectId, raisedBy, and reason are required.' });
    }

    let newDispute;

    if (supabaseService.isConfigured()) {
      const existing = await supabaseService.getDisputes();
      const newDisputeId = (existing ? existing.length : 0) + 1;

      newDispute = await supabaseService.createDispute({
        disputeId: newDisputeId,
        projectId: Number(projectId),
        raisedBy,
        reason,
        status: 'Pending',
      });
    } else {
      const count = await Dispute.countDocuments();
      newDispute = new Dispute({
        disputeId: count + 1,
        projectId: Number(projectId),
        raisedBy,
        reason,
        status: 'Pending',
      });
      await newDispute.save();
    }

    res.status(201).json({
      message: 'Dispute appeal filed successfully',
      dispute: newDispute,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/disputes/:id/status — Resolve or Reject a dispute
// ──────────────────────────────────────────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Pending', 'Resolved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    let d;

    if (supabaseService.isConfigured()) {
      const supabase = supabaseService.getClient();
      const updates = {
        status,
        resolved_at: status !== 'Pending' ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from('disputes')
        .update(updates)
        .eq('dispute_id', Number(id))
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Dispute not found.' });
      }
      d = data;
    } else {
      d = await Dispute.findOne({ disputeId: Number(id) });
      if (!d) return res.status(404).json({ error: 'Dispute not found.' });
      d.status = status;
      if (status !== 'Pending') d.resolvedAt = new Date();
      await d.save();
    }

    res.json({ message: `Dispute #${id} set to ${status}`, dispute: d });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
