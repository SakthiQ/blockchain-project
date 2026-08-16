const express = require('express');
const router = express.Router();
const ProjectApplication = require('../models/ProjectApplication');

// Get all applications
router.get('/', async (req, res) => {
  try {
    const applications = await ProjectApplication.find().sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new team application
router.post('/', async (req, res) => {
  try {
    const { name, description, teamLead, category, ipfsCID, applicantWallet } = req.body;

    if (!name || !teamLead || !applicantWallet) {
      return res.status(400).json({ error: 'Name, teamLead, and applicantWallet are required.' });
    }

    const count = await ProjectApplication.countDocuments();
    const newAppId = count + 1;

    const newApp = new ProjectApplication({
      applicationId: newAppId,
      name,
      description: description || '',
      teamLead,
      category: category || 'DeFi',
      ipfsCID: ipfsCID || '',
      applicantWallet,
      status: 'Pending',
    });

    await newApp.save();

    res.status(201).json({
      message: 'Project application submitted successfully',
      application: newApp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update application status (Approve / Reject)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, registeredProjectId } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const app = await ProjectApplication.findOne({ applicationId: Number(id) });
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    app.status = status;
    if (registeredProjectId) app.registeredProjectId = registeredProjectId;

    await app.save();

    res.json({
      message: `Application #${id} set to ${status}`,
      application: app,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
