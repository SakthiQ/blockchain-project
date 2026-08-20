const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const ProjectApplication = require('../models/ProjectApplication'); // Mongoose fallback

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/applications — Return all applications
// ──────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (supabaseService.isConfigured()) {
      const data = await supabaseService.getApplications();
      return res.json(data || []);
    }
    const applications = await ProjectApplication.find().sort({ createdAt: -1 });
    res.json(applications);
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

    let newApp;

    if (supabaseService.isConfigured()) {
      const existing = await supabaseService.getApplications();
      const newAppId = (existing ? existing.length : 0) + 1;

      newApp = await supabaseService.createApplication({
        applicationId: newAppId,
        name,
        description: description || '',
        teamLead,
        category: category || 'DeFi',
        ipfsCID: ipfsCID || '',
        applicantWallet,
        status: 'Pending',
        registeredProjectId: 0,
      });
    } else {
      const count = await ProjectApplication.countDocuments();
      newApp = new ProjectApplication({
        applicationId: count + 1,
        name,
        description: description || '',
        teamLead,
        category: category || 'DeFi',
        ipfsCID: ipfsCID || '',
        applicantWallet,
        status: 'Pending',
      });
      await newApp.save();
    }

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

    let app;

    if (supabaseService.isConfigured()) {
      const supabase = supabaseService.getClient();
      const updates = { status };
      if (registeredProjectId) updates.registered_project_id = registeredProjectId;

      const { data, error } = await supabase
        .from('project_applications')
        .update(updates)
        .eq('application_id', Number(id))
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Application not found.' });
      }
      app = data;
    } else {
      app = await ProjectApplication.findOne({ applicationId: Number(id) });
      if (!app) return res.status(404).json({ error: 'Application not found.' });
      app.status = status;
      if (registeredProjectId) app.registeredProjectId = registeredProjectId;
      await app.save();
    }

    res.json({ message: `Application #${id} set to ${status}`, application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
