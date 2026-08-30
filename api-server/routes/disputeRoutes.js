const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const requireSupabase = require('../middleware/requireSupabase');

router.use(requireSupabase);

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/disputes — Return all disputes
// ──────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const data = await supabaseService.getDisputes();
    res.json(data);
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

    const newDispute = await supabaseService.createDispute({
      projectId: Number(projectId),
      raisedBy,
      reason,
      status: 'Pending',
    });

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

    const d = await supabaseService.updateDisputeStatus(id, {
      status,
      resolved_at: status !== 'Pending' ? new Date().toISOString() : null,
    });
    if (!d) return res.status(404).json({ error: 'Dispute not found.' });

    res.json({ message: `Dispute #${id} set to ${status}`, dispute: d });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
