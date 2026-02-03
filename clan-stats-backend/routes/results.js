const express = require('express');
const router = express.Router();
const multer = require('multer');
const { ResultService, MemberService, ClanService } = require('../services/firebaseService');
const OCRService = require('../services/ocrService');
const stringSimilarity = require('string-similarity');
const { authMiddleware } = require('../middleware/auth');

// Helper to verify clan access (owner or invited member)
const verifyClanAccess = async (clanId, userId, userEmail) => {
  const access = await ClanService.verifyUserAccess(clanId, userId, userEmail);

  if (!access.canAccess) {
    return { error: 'Not authorized to access this clan', status: 403 };
  }

  // Verifiche aggiuntive per ruolo (es. solo 'uploader' può caricare)
  if (access.role === 'viewer') {
    return { error: 'You can only view this clan', status: 403 };
  }

  const clan = await ClanService.findById(clanId);
  return { clan, role: access.role };
};

// Keep disk storage available for routes that may want to persist files,
// but for immediate OCR processing we will use memory storage to avoid
// writing to disk in production (Cloud Run).
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, 'result-' + Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: diskStorage });

// Memory upload for in-memory processing (no disk writes)
const memoryUpload = multer({ storage: multer.memoryStorage() });

// Extract text from screenshot (OCR Preview) - Handles single or multiple files (requires auth)
router.post('/extract', authMiddleware, memoryUpload.array('screenshot', 6), async (req, res) => {
  try {
    const { clanId } = req.body;
    const useDocumentDetection = true; // Always use DOCUMENT_TEXT_DETECTION

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Screenshots are required' });
    }

    // Verify clan access
    if (clanId) {
      const access = await verifyClanAccess(clanId, req.user.uid, req.user.email);
      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }
    }

    // Get clan details including members for matching
    let clanTag = '';
    let clanMembers = [];

    if (clanId) {
      const clan = await ClanService.findById(clanId);
      if (clan) {
        clanTag = clan.tag;

        // Fetch members for this clan
        const members = await MemberService.findByClan(clanId, true);
        clanMembers = members.map(m => m.playerName);
      }
    }

    let allParsedResults = [];

    // Process each file
    for (const file of req.files) {
      // Extract text from screenshot (process buffer directly)
      const extractedText = await OCRService.extractTextFromImage(file.buffer, useDocumentDetection);

      // Parse member results
      const rawResults = OCRService.parseMemberResults(extractedText, clanTag);

      // Post-process with fuzzy matching if we have clan members
      if (clanMembers.length > 0) {
        // Uppercase map for comparison
        const clanMembersUpper = clanMembers.map(m => m.toUpperCase());

        rawResults.forEach(result => {
          const ocrNameUpper = result.playerName.toUpperCase();
          let matched = false;

          // FIRST: Check if any member nickname is contained in the OCR string (direct substring match)
          for (let i = 0; i < clanMembersUpper.length; i++) {
            if (ocrNameUpper.includes(clanMembersUpper[i]) || clanMembersUpper[i].includes(ocrNameUpper)) {
              result.originalOcrName = result.playerName;
              result.playerName = clanMembers[i];
              result.isMatched = true;
              matched = true;
              break;
            }
          }

          // SECOND: If no direct match, use fuzzy string similarity
          if (!matched) {
            const matches = stringSimilarity.findBestMatch(ocrNameUpper, clanMembersUpper);
            const bestMatch = matches.bestMatch;

            // Check if match is good enough
            if (bestMatch.rating >= 0.5) {
              // Find the original name index
              const bestMatchIndex = matches.bestMatchIndex !== undefined ? matches.bestMatchIndex : clanMembersUpper.indexOf(bestMatch.target);

              if (bestMatchIndex !== -1) {
                const originalName = clanMembers[bestMatchIndex]; // Get original case name

                // Save original scanned name if different
                result.originalOcrName = result.playerName;

                // Replace with matched member name
                result.playerName = originalName;
                result.isMatched = true;
              }
            } else {
              result.isMatched = false;
            }
          }
        });
      }

      allParsedResults = [...allParsedResults, ...rawResults];
    }

    // De-duplicate results (keep highest score or latest?) - Simple de-dup by name
    const uniqueResults = [];
    const map = new Map();
    for (const item of allParsedResults) {
      if (!map.has(item.playerName)) {
        map.set(item.playerName, true);    // set any value to Map
        uniqueResults.push(item);
      }
    }

    // Return combined parsed data without saving
    res.json(uniqueResults);

  } catch (error) {
    console.error('Extract results error:', error);
    res.status(500).json({ error: 'Failed to extract results' });
  }
});

// Bulk save results (requires auth)
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { clanId, week, results, bossLevel } = req.body;

    if (!clanId || !week || !results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid, req.user.email);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    let savedCount = 0;

    for (const item of results) {
      if (!item.memberId) continue;
      // Allow saving even with score 0 or empty if we have missedBoss flags
      const hasScore = item.score !== '' && item.score !== null && item.score !== undefined;
      const hasMissedFlags = item.missedBossDay1 || item.missedBossDay2 || item.missedBossDay3;

      if (!hasScore && !hasMissedFlags) continue;

      // Update or Insert - also save playerName for historical reference
      await ResultService.upsertByMemberClanWeek(item.memberId, clanId, week, {
        score: hasScore ? item.score : 0,
        bossLevel: bossLevel || null,
        missedBossDay1: item.missedBossDay1 || false,
        missedBossDay2: item.missedBossDay2 || false,
        missedBossDay3: item.missedBossDay3 || false,
        isManualEntry: true,
        playerName: item.playerName || null // Save player name for historical reference
      });
      savedCount++;
    }

    res.json({ message: `Saved ${savedCount} results` });

  } catch (error) {
    console.error('Bulk save results error:', error);
    res.status(500).json({ error: 'Failed to save results' });
  }
});


// Upload results via screenshot (Legacy/Direct) - requires auth
router.post('/upload', authMiddleware, memoryUpload.single('screenshot'), async (req, res) => {
  try {
    const { clanId, week } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Screenshot is required' });
    }

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid, req.user.email);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }
    const clan = access.clan;

    // Extract text from screenshot (process buffer directly without persisting)
    const extractedText = await OCRService.extractTextFromImage(req.file.buffer);

    // Parse member results
    const parsedResults = OCRService.parseMemberResults(extractedText, clan.tag);

    if (parsedResults.length === 0) {
      return res.status(400).json({ error: 'No valid results found in screenshot' });
    }

    const savedResults = [];

    for (const resultData of parsedResults) {
      // Find or create member
      let member = await MemberService.findByNameInClan(resultData.playerName, clanId);

      if (!member) {
        // Auto-create member if not exists
        member = await MemberService.create({
          playerName: resultData.playerName,
          playerId: resultData.playerName.toLowerCase().replace(/\s/g, '_') + '_' + Date.now(),
          clanId
        });
      }

      // Check if result already exists for this week
      const existingResult = await ResultService.findByMemberClanWeek(member.id, clanId, week);

      if (!existingResult) {
        const result = await ResultService.create({
          memberId: member.id,
          clanId,
          score: resultData.score,
          week,
          screenshot: null,
          isManualEntry: false
        });

        savedResults.push({ ...result, _id: result.id });
      }
    }

    res.status(201).json({
      message: `Successfully processed ${savedResults.length} results`,
      results: savedResults
    });
  } catch (error) {
    console.error('Upload results error:', error);
    res.status(500).json({ error: 'Failed to upload results' });
  }
});

// Manual result entry (requires auth)
router.post('/manual', authMiddleware, async (req, res) => {
  try {
    const { memberId, clanId, score, week } = req.body;

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid, req.user.email);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const result = await ResultService.create({
      memberId,
      clanId,
      score,
      week,
      isManualEntry: true
    });

    res.status(201).json({
      message: 'Result added successfully',
      result: { ...result, _id: result.id }
    });
  } catch (error) {
    console.error('Manual result entry error:', error);
    res.status(500).json({ error: 'Failed to add result' });
  }
});

// Get results for a specific week or all weeks (requires auth)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { clanId, week } = req.query;

    // Verify clan access
    if (clanId) {
      const access = await verifyClanAccess(clanId, req.user.uid);
      if (access.error) {
        return res.status(access.status).json({ error: access.error });
      }
    }

    const results = await ResultService.findWithFilters({ clanId, week });
    const populatedResults = await ResultService.populateMembers(results);

    // Format for compatibility
    const formattedResults = populatedResults.map(r => ({
      ...r,
      _id: r.id,
      member: r.member ? { _id: r.member.id, playerName: r.member.playerName } : null
    }));

    res.json(formattedResults);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// Compare results with history (requires auth)
router.get('/compare', authMiddleware, async (req, res) => {
  try {
    const { clanId, week } = req.query;
    if (!clanId || !week) return res.status(400).json({ error: 'Missing parameters' });

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid, req.user.email);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    // Helper to get previous week string in format "YYYY-Www"
    const getPreviousWeek = (currentWeekStr, weeksBack) => {
      const match = currentWeekStr.match(/^(\d{4})-W(\d{2})$/);
      if (!match) {
        console.error('Invalid week format:', currentWeekStr);
        return null;
      }

      let year = parseInt(match[1]);
      let weekNum = parseInt(match[2]);

      let targetWeekNum = weekNum - weeksBack;
      let targetYear = year;

      while (targetWeekNum <= 0) {
        targetYear--;
        targetWeekNum += 52;
      }

      return `${targetYear}-W${targetWeekNum.toString().padStart(2, '0')}`;
    };

    // Get last 12 weeks for average calculation
    const weeksToFetch = [week];
    for (let i = 1; i <= 12; i++) {
      const prevWeek = getPreviousWeek(week, i);
      if (prevWeek) weeksToFetch.push(prevWeek);
    }

    const results = await ResultService.findByClanAndWeeks(clanId, weeksToFetch);
    const populatedResults = await ResultService.populateMembers(results);

    // Group by member
    const memberStats = {};

    populatedResults.forEach(r => {
      // If member not found, use playerName from result itself (for deleted members)
      const memberInfo = r.member
        ? { _id: r.member.id, playerName: r.member.playerName }
        : { _id: r.memberId, playerName: r.playerName || 'Unknown' };

      const mId = r.memberId;
      if (!memberStats[mId]) {
        memberStats[mId] = {
          member: memberInfo,
          current: null,
          week1: null,
          bossLevel: null,
          missedBossDay1: false,
          missedBossDay2: false,
          missedBossDay3: false,
          weeklyScores: []
        };
      }

      if (r.week === week) {
        memberStats[mId].current = r.score;
        memberStats[mId].bossLevel = r.bossLevel;
        memberStats[mId].missedBossDay1 = r.missedBossDay1 || false;
        memberStats[mId].missedBossDay2 = r.missedBossDay2 || false;
        memberStats[mId].missedBossDay3 = r.missedBossDay3 || false;
      } else if (r.week === getPreviousWeek(week, 1)) {
        memberStats[mId].week1 = r.score;
      }

      if (r.score && r.score > 0) {
        memberStats[mId].weeklyScores.push({ week: r.week, score: r.score });
      }
    });

    // Calculate average weekly improvement for each member
    Object.values(memberStats).forEach(stat => {
      stat.weeklyScores.sort((a, b) => a.week.localeCompare(b.week));

      const improvements = [];
      for (let i = 1; i < stat.weeklyScores.length; i++) {
        const diff = stat.weeklyScores[i].score - stat.weeklyScores[i - 1].score;
        improvements.push(diff);
      }

      if (improvements.length > 0) {
        stat.avgImprovement = Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
      } else {
        stat.avgImprovement = null;
      }

      delete stat.weeklyScores;
    });

    // Calculate total scores per week (top 30)
    const weeklyTotals = {};
    weeksToFetch.forEach(w => {
      const weekScores = populatedResults
        .filter(r => r.week === w && r.score > 0)
        .map(r => r.score)
        .sort((a, b) => b - a)
        .slice(0, 30);
      weeklyTotals[w] = weekScores.reduce((sum, s) => sum + s, 0);
    });

    const sortedWeeks = Object.keys(weeklyTotals).sort();
    const totalImprovements = [];
    for (let i = 1; i < sortedWeeks.length; i++) {
      const prevTotal = weeklyTotals[sortedWeeks[i - 1]];
      const currTotal = weeklyTotals[sortedWeeks[i]];
      if (prevTotal > 0 && currTotal > 0) {
        totalImprovements.push(currTotal - prevTotal);
      }
    }

    const avgTotalImprovement = totalImprovements.length > 0
      ? Math.round(totalImprovements.reduce((a, b) => a + b, 0) / totalImprovements.length)
      : null;

    const memberArray = Object.values(memberStats);

    // Get bossLevel from current week, or fallback to previous week
    let currentWeekBossLevel = null;
    let previousWeekBossLevel = null;

    populatedResults.forEach(r => {
      if (r.bossLevel) {
        if (r.week === week) {
          currentWeekBossLevel = r.bossLevel;
        } else if (r.week === getPreviousWeek(week, 1)) {
          previousWeekBossLevel = r.bossLevel;
        }
      }
    });

    res.json({
      members: memberArray,
      totals: {
        current: weeklyTotals[week] || 0,
        week1: weeklyTotals[getPreviousWeek(week, 1)] || 0,
        avgImprovement: avgTotalImprovement
      },
      bossLevel: currentWeekBossLevel || previousWeekBossLevel || null,
      previousWeekBossLevel: previousWeekBossLevel
    });

  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch comparison' });
  }
});

// Get weekly results for a clan (requires auth)
router.get('/clan/:clanId/week/:week', authMiddleware, async (req, res) => {
  try {
    // Verify clan access
    const access = await verifyClanAccess(req.params.clanId, req.user.uid, req.user.email);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const results = await ResultService.findByClanAndWeek(req.params.clanId, req.params.week);
    const populatedResults = await ResultService.populateMembers(results);

    // Sort by score descending and format
    const formattedResults = populatedResults
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map(r => ({
        ...r,
        _id: r.id,
        member: r.member ? { _id: r.member.id, playerName: r.member.playerName } : null
      }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Get weekly results error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get statistics for charts (requires auth)
router.get('/statistics/:clanId', authMiddleware, async (req, res) => {
  try {
    const { clanId } = req.params;
    const { weeks = 12 } = req.query;
    const numWeeks = parseInt(weeks);

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid, req.user.email);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    // Get all results for the clan
    const allResults = await ResultService.findByClan(clanId);
    // Populate only positive scores for member analysis, but derive weeks from allResults
    const populatedResults = await ResultService.populateMembers(allResults.filter(r => r.score > 0));

    // Get unique weeks from all results (include weeks with zero scores so charts show timeline)
    const uniqueWeeks = [...new Set(allResults.map(r => r.week))].filter(Boolean).sort().reverse();
    const weeksToAnalyze = uniqueWeeks.slice(0, numWeeks).reverse();

    // Calculate weekly totals (top 30) and averages
    const weeklyTotals = [];
    const weeklyAverages = [];

    weeksToAnalyze.forEach(week => {
      const weekResults = populatedResults
        .filter(r => r.week === week)
        .sort((a, b) => b.score - a.score);

      const top30Scores = weekResults.slice(0, 30).map(r => r.score);
      const total = top30Scores.reduce((sum, s) => sum + s, 0);
      const avg = top30Scores.length > 0 ? Math.round(total / top30Scores.length) : 0;

      weeklyTotals.push({ week, total });
      weeklyAverages.push({ week, average: avg, memberCount: top30Scores.length });
    });

    // Calculate growth rates for clan
    const clanGrowth = [];
    for (let i = 1; i < weeklyTotals.length; i++) {
      const prev = weeklyTotals[i - 1].total;
      const curr = weeklyTotals[i].total;
      const growth = prev > 0 ? curr - prev : 0;
      const growthPercent = prev > 0 ? ((curr - prev) / prev * 100).toFixed(1) : 0;
      clanGrowth.push({
        week: weeklyTotals[i].week,
        growth,
        growthPercent: parseFloat(growthPercent)
      });
    }

    // Calculate individual member growth
    const memberMap = new Map();

    populatedResults.forEach(r => {
      if (!weeksToAnalyze.includes(r.week)) return;

      // Use member info if available, otherwise use playerName from result
      const playerName = r.member?.playerName || r.playerName || 'Unknown';
      const isActive = r.member?.isActive ?? false;

      const memberId = r.memberId;
      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, {
          memberId,
          playerName,
          isActive,
          weeklyScores: []
        });
      }
      memberMap.get(memberId).weeklyScores.push({
        week: r.week,
        score: r.score,
        missedBossDay1: r.missedBossDay1 || false,
        missedBossDay2: r.missedBossDay2 || false,
        missedBossDay3: r.missedBossDay3 || false
      });
    });

    // Process each member's data
    const memberGrowth = [];
    memberMap.forEach(member => {
      member.weeklyScores.sort((a, b) => a.week.localeCompare(b.week));

      const improvements = [];
      for (let i = 1; i < member.weeklyScores.length; i++) {
        improvements.push(member.weeklyScores[i].score - member.weeklyScores[i - 1].score);
      }

      const avgImprovement = improvements.length > 0
        ? Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length)
        : null;

      const totalGrowth = member.weeklyScores.length >= 2
        ? member.weeklyScores[member.weeklyScores.length - 1].score - member.weeklyScores[0].score
        : 0;

      memberGrowth.push({
        memberId: member.memberId,
        playerName: member.playerName,
        isActive: member.isActive,
        weeklyScores: member.weeklyScores,
        avgImprovement,
        totalGrowth,
        weeksPlayed: member.weeklyScores.length
      });
    });

    memberGrowth.sort((a, b) => (b.avgImprovement || 0) - (a.avgImprovement || 0));

    res.json({
      weeklyTotals,
      weeklyAverages,
      clanGrowth,
      memberGrowth,
      availableWeeks: uniqueWeeks
    });

  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
