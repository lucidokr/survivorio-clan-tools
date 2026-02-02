const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MemberService, ClanService } = require('../services/firebaseService');
const CoordinateOCRService = require('../services/coordinateOCRService');
const { authMiddleware } = require('../middleware/auth');

// Helper to verify clan ownership
const verifyClanAccess = async (clanId, userId) => {
  const clan = await ClanService.findById(clanId);
  if (!clan) {
    return { error: 'Clan not found', status: 404 };
  }
  if (clan.ownerId !== userId) {
    return { error: 'You do not have permission to access this clan', status: 403 };
  }
  return { clan };
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Preview members from screenshot with coordinates (requires auth)
router.post('/preview', authMiddleware, upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Screenshot is required' });
    }

    const { clanId, useCoordinates = true } = req.body;

    if (!clanId) {
      return res.status(400).json({ error: 'Clan ID is required' });
    }

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }
    const clan = access.clan;

    console.log('Processing member import preview with coordinates...');

    let extractedText;
    let members;
    let visionData = null;

    if (useCoordinates) {
      // Get real image dimensions and coordinates
      const coordinates = await CoordinateOCRService.getMemberListCoordinates(req.file.path);

      const visionResponse = await CoordinateOCRService.extractWithCoordinates(req.file.path, coordinates);
      extractedText = visionResponse.text;
      visionData = visionResponse.fullResponse;
      members = CoordinateOCRService.parseClanMembersFromCoordinates(extractedText, clan.tag, visionData);
    } else {
      // Fallback to full image OCR
      extractedText = await CoordinateOCRService.extractTextFromImage(req.file.path);
      members = CoordinateOCRService.parseClanMembersFromCoordinates(extractedText, clan.tag);
    }

    // Check for existing members
    const existingMembers = await MemberService.findByClan(clanId, true);

    const existingNames = new Set(existingMembers.map(m => m.playerName.toLowerCase()));

    // Categorize members
    const newMembers = members.filter(m => !existingNames.has(m.playerName.toLowerCase()));
    const existingMembersFound = members.filter(m => existingNames.has(m.playerName.toLowerCase()));

    res.json({
      success: true,
      extractedText: extractedText,
      visionData: visionData, // Full Google Vision response (null if not using coordinates)
      members: members,
      newMembers: newMembers,
      existingMembersFound: existingMembersFound,
      totalFound: members.length,
      clanInfo: {
        name: clan.name,
        tag: clan.tag
      }
    });

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to process screenshot' });
  }
});

// Import confirmed members (requires auth)
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const { clanId, members } = req.body;

    if (!clanId || !members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    // Check for existing members
    const existingMembers = await MemberService.findByClan(clanId, true);

    const existingNames = new Set(existingMembers.map(m => m.playerName.toLowerCase()));

    // Only import new members
    const newMembers = members.filter(m => !existingNames.has(m.playerName.toLowerCase()));

    if (newMembers.length === 0) {
      return res.json({
        success: true,
        message: 'No new members to import',
        importedCount: 0
      });
    }

    // Create new members
    const memberDocs = newMembers.map(member => ({
      playerName: member.playerName,
      playerId: member.playerName.toLowerCase().replace(/\s/g, '_') + '_' + Date.now(),
      clanId: clanId,
      level: member.level || 1,
      atk: member.atk || 0
    }));

    const savedMembers = await MemberService.bulkCreate(memberDocs);

    res.json({
      success: true,
      message: `Successfully imported ${savedMembers.length} new members`,
      importedCount: savedMembers.length,
      members: savedMembers.map(m => ({ ...m, _id: m.id }))
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import members' });
  }
});

module.exports = router;
