const express = require('express');
const router = express.Router();
const { ClanService } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');

// Middleware to verify clan ownership
const verifyClanOwnership = async (req, res, next) => {
  try {
    const clanId = req.params.id || req.params.clanId || req.body.clanId;
    if (!clanId) {
      return res.status(400).json({ error: 'Clan ID is required' });
    }

    const clan = await ClanService.findById(clanId);
    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    // Check if user owns this clan
    if (clan.ownerId !== req.user.uid) {
      return res.status(403).json({ error: 'You do not have permission to access this clan' });
    }

    req.clan = clan;
    next();
  } catch (error) {
    console.error('Verify ownership error:', error);
    res.status(500).json({ error: 'Failed to verify clan ownership' });
  }
};

// Register a new clan (any authenticated user) — no OCR required
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const { name, tag, description } = req.body;

    if (!name || !tag) {
      return res.status(400).json({ error: 'Name and tag required' });
    }

    // Ensure tag is unique
    const existingByTag = await ClanService.findByTag(tag);
    if (existingByTag) {
      return res.status(400).json({ error: 'Clan tag already exists' });
    }

    // Create new clan with owner set to current user
    const clan = await ClanService.create({
      name,
      tag,
      description
    }, req.user.uid);

    res.status(201).json({
      message: 'Clan registered successfully',
      clan: {
        id: clan.id,
        name: clan.name,
        clanId: clan.clanId,
        tag: clan.tag,
        ownerId: clan.ownerId
      }
    });
  } catch (error) {
    console.error('Clan registration error:', error);
    res.status(500).json({ error: 'Failed to register clan' });
  }
});

// Create a new clan - NEW ENDPOINT
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, tag } = req.body;

    if (!name || !tag) {
      return res.status(400).json({ error: 'Name and tag required' });
    }

    const clan = await ClanService.create({
      name,
      tag,
      ownersEmail: req.user.email
    }, req.user.uid);

    res.status(201).json({
      message: 'Clan created successfully',
      clan: {
        id: clan.id,
        _id: clan.id,
        name: clan.name,
        tag: clan.tag,
        ownerId: clan.ownerId
      }
    });
  } catch (error) {
    console.error('Create clan error:', error);
    res.status(500).json({ error: 'Failed to create clan' });
  }
});

// Get user's clans (requires auth)
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const clans = await ClanService.findByOwner(req.user.uid);

    const formattedClans = clans.map(clan => ({
      _id: clan.id,
      id: clan.id,
      name: clan.name,
      clanId: clan.clanId,
      tag: clan.tag,
      createdAt: clan.createdAt
    }));

    res.json(formattedClans);
  } catch (error) {
    console.error('Get my clans error:', error);
    res.status(500).json({ error: 'Failed to fetch clans', details: error.message });
  }
});

// Get user's accessible clans (owned + invited) - NEW ENDPOINT
router.get('/my-clans', authMiddleware, async (req, res) => {
  try {
    const clans = await ClanService.findAccessibleClans(req.user.uid, req.user.email);

    const formattedClans = clans.map(clan => ({
      _id: clan.id,
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      ownerId: clan.ownerId,
      myRole: clan.myRole || 'owner',
      createdAt: clan.createdAt
    }));

    res.json(formattedClans);
  } catch (error) {
    console.error('Get my accessible clans error:', error);
    res.status(500).json({ error: 'Failed to fetch clans', details: error.message });
  }
});

// Get all clans (protected)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Users can only see their own clans
    const clans = await ClanService.findByOwner(req.user.uid);

    // Map to expected format
    const formattedClans = clans.map(clan => ({
      _id: clan.id,
      id: clan.id,
      name: clan.name,
      clanId: clan.clanId,
      tag: clan.tag,
      createdAt: clan.createdAt
    }));

    res.json(formattedClans);
  } catch (error) {
    console.error('Get clans error:', error);
    res.status(500).json({ error: 'Failed to fetch clans', details: error.message });
  }
});

// Get clan by ID (verify ownership)
router.get('/:id', authMiddleware, verifyClanOwnership, async (req, res) => {
  try {
    const clan = req.clan;

    // Add _id for compatibility
    clan._id = clan.id;

    res.json(clan);
  } catch (error) {
    console.error('Get clan error:', error);
    res.status(500).json({ error: 'Failed to fetch clan' });
  }
});

// Update clan (owner only)
router.put('/:id', authMiddleware, verifyClanOwnership, async (req, res) => {
  try {
    const { name, tag, description } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (tag) updateData.tag = tag;
    if (description !== undefined) updateData.description = description;

    const updatedClan = await ClanService.update(req.params.id, updateData);

    res.json({
      _id: updatedClan.id,
      id: updatedClan.id,
      ...updatedClan
    });
  } catch (error) {
    console.error('Update clan error:', error);
    res.status(500).json({ error: 'Failed to update clan' });
  }
});

// Delete clan (owner only) - cascade delete related data
router.delete('/:id', authMiddleware, verifyClanOwnership, async (req, res) => {
  try {
    await ClanService.deleteClanCascade(req.params.id);
    res.json({ message: 'Clan and related data deleted' });
  } catch (error) {
    console.error('Delete clan error:', error);
    res.status(500).json({ error: 'Failed to delete clan' });
  }
});

// Export middleware for use in other routes
module.exports = router;
module.exports.verifyClanOwnership = verifyClanOwnership;
