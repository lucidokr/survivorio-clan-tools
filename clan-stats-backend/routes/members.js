const express = require('express');
const router = express.Router();
const { MemberService, ClanService, ClanInvitationService } = require('../services/firebaseService');
const { authMiddleware } = require('../middleware/auth');

// Helper to filter undefined properties from object (Firestore cannot handle undefined)
const filterUndefined = (obj) => {
  const filtered = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      filtered[key] = value;
    }
  }
  return filtered;
};

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

// Invite a member to the clan via email - NEW ENDPOINT
router.post('/invite', authMiddleware, async (req, res) => {
  try {
    const { clanId, memberId, email, role } = req.body;

    if (!clanId || !memberId || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify: sei owner del clan?
    const clan = await ClanService.findById(clanId);
    if (!clan || clan.ownerId !== req.user.uid) {
      return res.status(403).json({ error: 'Only clan owner can invite members' });
    }

    // Verify that the member exists and belongs to this clan
    const member = await MemberService.findById(memberId);
    if (!member || member.clanId !== clanId) {
      return res.status(404).json({ error: 'Member not found in this clan' });
    }

    // Crea invitation
    const invitation = await ClanInvitationService.create(
      clanId,
      memberId,
      email,
      role,
      req.user.email
    );

    // TODO: Invia email di invito
    // await sendInvitationEmail(email, clan.name, member.playerName, ...);

    res.json({
      message: 'Invitation sent',
      invitation
    });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Delete an invitation - NEW ENDPOINT
router.delete('/invite/:invitationId', authMiddleware, async (req, res) => {
  try {
    const { invitationId } = req.params;

    if (!invitationId) {
      return res.status(400).json({ error: 'Invitation ID required' });
    }

    // Verify that the invitation exists and user is the clan owner
    const invitation = await ClanInvitationService.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const clan = await ClanService.findById(invitation.clanId);
    if (!clan || clan.ownerId !== req.user.uid) {
      return res.status(403).json({ error: 'Only clan owner can delete invitations' });
    }

    // Delete the invitation
    await ClanInvitationService.delete(invitationId);

    res.json({
      message: 'Invitation deleted',
      invitationId
    });
  } catch (error) {
    console.error('Delete invitation error:', error);
    res.status(500).json({ error: 'Failed to delete invitation' });
  }
});

// Create a new member (requires auth)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { playerName, playerId, phoneNumber, discordNickname, clanId } = req.body;

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    // Check if member already exists
    const existingMember = await MemberService.findByPlayerIdOrNameInClan(playerId, playerName, clanId);

    if (existingMember) {
      return res.status(400).json({ error: 'Member already exists' });
    }

    const member = await MemberService.create({
      playerName,
      playerId,
      phoneNumber,
      discordNickname,
      clanId
    });

    res.status(201).json({
      message: 'Member created successfully',
      member: { ...member, _id: member.id }
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Get all members of a clan (requires auth)
router.get('/clan/:clanId', authMiddleware, async (req, res) => {
  try {
    const { clanId } = req.params;

    // Verifica: utente ha accesso al clan?
    const access = await ClanService.verifyUserAccess(
      clanId,
      req.user.uid,
      req.user.email
    );

    if (!access.canAccess) {
      return res.status(403).json({ error: 'Not authorized to view this clan' });
    }

    // Include all members (active and inactive) to preserve historical results
    const members = await MemberService.findByClan(clanId, false);

    // Add _id for compatibility
    const formattedMembers = members.map(m => ({ ...m, _id: m.id }));

    res.json(formattedMembers);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Update member (requires auth)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { playerName, phoneNumber, discordNickname } = req.body;

    // Get member first to verify clan access
    const existingMember = await MemberService.findById(req.params.id);
    if (!existingMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Verify clan access
    const access = await verifyClanAccess(existingMember.clanId, req.user.uid);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const member = await MemberService.update(req.params.id, {
      playerName,
      phoneNumber,
      discordNickname
    });

    res.json({
      message: 'Member updated successfully',
      member: { ...member, _id: member.id }
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Delete member (soft delete, requires auth)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await MemberService.findById(req.params.id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Verify clan access
    const access = await verifyClanAccess(member.clanId, req.user.uid);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    await MemberService.softDelete(req.params.id);

    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// Get member by ID (requires auth)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await MemberService.findByIdWithClan(req.params.id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Verify clan access
    const access = await verifyClanAccess(member.clanId, req.user.uid);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    res.json({ ...member, _id: member.id });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Bulk update members (requires auth)
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { clanId, members } = req.body;

    if (!clanId) {
      return res.status(400).json({ error: 'Clan ID is required' });
    }

    // Verify clan access
    const access = await verifyClanAccess(clanId, req.user.uid);
    if (access.error) {
      return res.status(access.status).json({ error: access.error });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const memberData of members) {
      // Skip empty entries
      if (!memberData.playerName || !memberData.playerId) continue;

      // Normalize email to lowercase
      const normalizedEmail = memberData.email ? memberData.email.toLowerCase().trim() : null;

      try {
        if (memberData._id || memberData.id) {
          // Update existing
          const id = memberData._id || memberData.id;
          await MemberService.update(id, filterUndefined({
            playerName: memberData.playerName,
            playerId: memberData.playerId,
            phoneNumber: memberData.phoneNumber,
            email: normalizedEmail,
            role: memberData.role,
            discordNickname: memberData.discordNickname
          }));
          results.updated++;
        } else {
          // Try to find by playerId
          const existing = await MemberService.findByPlayerId(memberData.playerId);

          if (existing) {
            if (existing.clanId === clanId) {
              await MemberService.update(existing.id, filterUndefined({
                playerName: memberData.playerName,
                phoneNumber: memberData.phoneNumber,
                email: normalizedEmail,
                role: memberData.role,
                discordNickname: memberData.discordNickname
              }));
              results.updated++;
            } else {
              results.errors.push(`Player ID ${memberData.playerId} already in another clan`);
            }
          } else {
            await MemberService.create({
              playerName: memberData.playerName,
              playerId: memberData.playerId,
              phoneNumber: memberData.phoneNumber,
              email: normalizedEmail,
              role: memberData.role,
              discordNickname: memberData.discordNickname,
              clanId
            });
            results.created++;
          }
        }
      } catch (err) {
        console.error(`Error processing member ${memberData.playerName}:`, err);
        results.errors.push(`Error for ${memberData.playerName}: ${err.message}`);
      }
    }

    res.json({
      message: 'Bulk operation completed',
      results
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Failed to process bulk update' });
  }
});

module.exports = router;
