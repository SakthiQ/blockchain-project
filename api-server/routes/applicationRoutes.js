const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const requireSupabase = require('../middleware/requireSupabase');

router.use(requireSupabase);

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/applications — Return all applications
// ──────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const data = await supabaseService.getApplications();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/applications — Submit a new team application
// ──────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, description, teamLead, category, ipfsCID, applicantWallet } = req.body;

    if (!name || !teamLead || !applicantWallet) {
      return res.status(400).json({ error: 'Name, teamLead, and applicantWallet are required.' });
    }

    const newApp = await supabaseService.createApplication({
      name,
      description,
      teamLead,
      category,
      ipfsCID,
      applicantWallet,
      status: 'Pending',
      registeredProjectId: 0,
    });

    res.status(201).json({
      message: 'Project application submitted successfully',
      application: newApp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/applications/:id/status — Approve or Reject application
// ──────────────────────────────────────────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, registeredProjectId } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const updates = { status };
    if (registeredProjectId) updates.registered_project_id = registeredProjectId;

    const app = await supabaseService.updateApplicationStatus(id, updates);
    if (!app) return res.status(404).json({ error: 'Application not found.' });

    res.json({ message: `Application #${id} set to ${status}`, application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
