const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { CommunityService, ClanService, ResultService } = require('../services/firebaseService');

// Admin email allowed to create/delete communities
const ADMIN_EMAIL = 'lucido.kristian@gmail.com';

// Create community (admin only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (!req.user || req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Only admin can create communities' });
        }

        const { name, description, clanIds } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        const community = await CommunityService.create({ name, description, clanIds: clanIds || [] }, req.user.uid);
        res.json(community);
    } catch (err) {
        console.error('Create community error:', err);
        res.status(500).json({ error: 'Failed to create community' });
    }
});

// List communities (all active)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const list = await CommunityService.findAll(true);
        res.json(list);
    } catch (err) {
        console.error('List communities error:', err);
        res.status(500).json({ error: 'Failed to list communities' });
    }
});

// Get community by id
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const community = await CommunityService.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });
        res.json(community);
    } catch (err) {
        console.error('Get community error:', err);
        res.status(500).json({ error: 'Failed to get community' });
    }
});

// Update community (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        if (!req.user || req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Only admin can update communities' });
        }
        const updated = await CommunityService.update(req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        console.error('Update community error:', err);
        res.status(500).json({ error: 'Failed to update community' });
    }
});

// Delete community (admin only) - soft delete
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (!req.user || req.user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Only admin can delete communities' });
        }
        await CommunityService.softDelete(req.params.id);
        res.json({ message: 'Community deleted' });
    } catch (err) {
        console.error('Delete community error:', err);
        res.status(500).json({ error: 'Failed to delete community' });
    }
});

// Add clan to community (requires clan owner or admin)
router.post('/:id/add-clan', authMiddleware, async (req, res) => {
    try {
        const { clanId } = req.body;
        if (!clanId) return res.status(400).json({ error: 'clanId required' });

        // Verify user is owner of the clan or admin
        const clan = await ClanService.findById(clanId);
        if (!clan) return res.status(404).json({ error: 'Clan not found' });

        // Only the clan owner can add their clan to a community
        if (clan.ownerId !== req.user.uid) {
            console.warn(`User ${req.user.uid} (${req.user.email}) attempted to add clan ${clanId} but is not the owner`);
            return res.status(403).json({ error: 'Only the clan owner can add this clan to a community' });
        }

        const updated = await CommunityService.addClan(req.params.id, clanId);
        res.json(updated);
    } catch (err) {
        console.error('Add clan to community error:', err);
        res.status(500).json({ error: 'Failed to add clan' });
    }
});

// Remove clan from community (requires clan owner or admin)
router.post('/:id/remove-clan', authMiddleware, async (req, res) => {
    try {
        const { clanId } = req.body;
        if (!clanId) return res.status(400).json({ error: 'clanId required' });

        const clan = await ClanService.findById(clanId);
        if (!clan) return res.status(404).json({ error: 'Clan not found' });

        // Only the clan owner can remove their clan from a community
        if (clan.ownerId !== req.user.uid) {
            console.warn(`User ${req.user.uid} (${req.user.email}) attempted to remove clan ${clanId} but is not the owner`);
            return res.status(403).json({ error: 'Only the clan owner can remove this clan from a community' });
        }

        const updated = await CommunityService.removeClan(req.params.id, clanId);
        res.json(updated);
    } catch (err) {
        console.error('Remove clan from community error:', err);
        res.status(500).json({ error: 'Failed to remove clan' });
    }
});

// Community stats aggregation
router.get('/:id/stats', authMiddleware, async (req, res) => {
    try {
        const { weeks = 12 } = req.query;
        const community = await CommunityService.findById(req.params.id);
        if (!community) return res.status(404).json({ error: 'Community not found' });

        const numWeeks = parseInt(weeks);
        const clanIds = community.clanIds || [];

        // Aggregate weekly totals per clan, then sum across clans
        const allResults = [];
        for (const clanId of clanIds) {
            const clanResults = await ResultService.findByClan(clanId);
            allResults.push(...clanResults.map(r => ({ ...r, clanId })));
        }

        if (allResults.length === 0) {
            return res.json({ weeklyTotals: [], weeklyAverages: [], clanGrowth: [], memberGrowth: [], availableWeeks: [] });
        }

        // Use similar logic as clan statistics but across all results
        // Include results with zero score so we can count missed boss days correctly
        const populated = await ResultService.populateMembers(allResults);
        const uniqueWeeks = [...new Set(populated.map(r => r.week))].sort().reverse();
        const weeksToAnalyze = uniqueWeeks.slice(0, numWeeks).reverse();

        const weeklyTotals = [];
        const weeklyAverages = [];

        weeksToAnalyze.forEach(week => {
            const weekResults = populated.filter(r => r.week === week).sort((a, b) => b.score - a.score);
            const top30 = weekResults.slice(0, 30).map(r => r.score);
            const total = top30.reduce((s, v) => s + v, 0);
            const avg = top30.length > 0 ? Math.round(total / top30.length) : 0;
            weeklyTotals.push({ week, total });
            weeklyAverages.push({ week, average: avg, memberCount: top30.length });
        });

        // Simple clanGrowth: sum diffs between weeks
        const clanGrowth = [];
        for (let i = 1; i < weeklyTotals.length; i++) {
            const prev = weeklyTotals[i - 1].total;
            const curr = weeklyTotals[i].total;
            clanGrowth.push({ week: weeklyTotals[i].week, growth: curr - prev, growthPercent: prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : 0 });
        }

        // Member growth similar to clan: group by memberId
        const memberMap = new Map();
        populated.forEach(r => {
            if (!weeksToAnalyze.includes(r.week)) return;
            const playerName = r.member?.playerName || r.playerName || 'Unknown';
            const memberId = r.memberId;
            if (!memberMap.has(memberId)) {
                memberMap.set(memberId, { memberId, playerName, weeklyScores: [] });
            }
            memberMap.get(memberId).weeklyScores.push({
                week: r.week,
                score: r.score,
                missedBossDay1: r.missedBossDay1 || false,
                missedBossDay2: r.missedBossDay2 || false,
                missedBossDay3: r.missedBossDay3 || false
            });
        });

        const memberGrowth = [];
        memberMap.forEach(m => {
            m.weeklyScores.sort((a, b) => a.week.localeCompare(b.week));
            const improvements = [];
            for (let i = 1; i < m.weeklyScores.length; i++) improvements.push(m.weeklyScores[i].score - m.weeklyScores[i - 1].score);
            const avgImprovement = improvements.length > 0 ? Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length) : null;
            const totalGrowth = m.weeklyScores.length >= 2 ? m.weeklyScores[m.weeklyScores.length - 1].score - m.weeklyScores[0].score : 0;
            memberGrowth.push({ memberId: m.memberId, playerName: m.playerName, weeklyScores: m.weeklyScores, avgImprovement, totalGrowth });
        });

        res.json({ weeklyTotals, weeklyAverages, clanGrowth, memberGrowth, availableWeeks: weeksToAnalyze });
    } catch (err) {
        console.error('Community stats error:', err);
        res.status(500).json({ error: 'Failed to compute community stats' });
    }
});

module.exports = router;
