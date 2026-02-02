const express = require('express');
const router = express.Router();
const { UserService, ClanService, ClanInvitationService } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // Accetta automaticamente gli inviti pending al primo login
        const pendingInvitations = await ClanInvitationService.findByEmail(req.user.email);
        const pending = pendingInvitations.filter(inv => inv.status === 'pending');

        for (const inv of pending) {
            await ClanInvitationService.accept(inv.id);
        }

        // Find or create user in Firestore
        const user = await UserService.findOrCreate({
            uid: req.user.uid,
            email: req.user.email,
            name: req.user.name,
            picture: req.user.picture
        });

        // Get user's accessible clans (owned + invited)
        const clans = await ClanService.findAccessibleClans(req.user.uid, req.user.email);

        res.json({
            user: {
                uid: user.uid,
                email: user.email,
                name: user.name,
                picture: user.picture,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            },
            clans: clans.map(c => ({
                id: c.id,
                _id: c.id,
                name: c.name,
                tag: c.tag,
                myRole: c.myRole || 'owner'
            }))
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

/**
 * POST /api/auth/sync
 * Sync user data on login (called after Google OAuth)
 */
router.post('/sync', authMiddleware, async (req, res) => {
    try {
        const user = await UserService.findOrCreate({
            uid: req.user.uid,
            email: req.user.email,
            name: req.user.name,
            picture: req.user.picture
        });

        res.json({
            message: 'User synced successfully',
            user: {
                uid: user.uid,
                email: user.email,
                name: user.name,
                picture: user.picture
            }
        });
    } catch (error) {
        console.error('Sync user error:', error);
        res.status(500).json({ error: 'Failed to sync user' });
    }
});

module.exports = router;
