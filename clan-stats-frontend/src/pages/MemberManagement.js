import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  TextField,
  Paper,
  Alert,
  CircularProgress,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const MAX_MEMBERS = 40;

const MemberManagement = () => {
  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState('');
  const [members, setMembers] = useState([]);
  const [originalPlayerIds, setOriginalPlayerIds] = useState({}); // Track original playerIds
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [warningDialog, setWarningDialog] = useState({ open: false, index: null, newValue: '' });
  const { user } = useAuth();

  // Auto-save feedback timer
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  useEffect(() => {
    fetchClans();
  }, []);

  useEffect(() => {
    if (selectedClan) {
      fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClan]);

  const fetchClans = async () => {
    try {
      const response = await api.clan.getMyClans();
      setClans(response);
      if (response.length > 0) {
        setSelectedClan(response[0]._id);
      }
    } catch (error) {
      console.error('Error fetching clans:', error);
      setError('Failed to fetch clans');
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const fetchedMembers = await api.members.getByClan(selectedClan);

      // Filter only active members (exclude deleted ones)
      const activeMembers = fetchedMembers.filter(m => m.isActive !== false);

      // Sort members by playerName (uppercase for sorting)
      activeMembers.sort((a, b) => {
        const nameA = (a.playerName || '').toUpperCase();
        const nameB = (b.playerName || '').toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      // Initialize array with 40 slots
      const fullList = Array(MAX_MEMBERS).fill().map((_, index) => {
        // If we have a member for this slot (based on array order roughly), use it
        // Or simply map fetched members to first N slots
        if (index < activeMembers.length) {
          return { ...activeMembers[index], isExisting: true };
        }
        return {
          playerName: '',
          playerId: '',
          phoneNumber: '',
          email: '',
          role: '',
          discordNickname: '', // Hidden but preserved structure
          isExisting: false
        };
      });

      setMembers(fullList);

      // Store original playerIds to detect changes
      const origIds = {};
      activeMembers.forEach(m => {
        if (m._id) origIds[m._id] = m.playerId;
      });
      setOriginalPlayerIds(origIds);
    } catch (error) {
      console.error('Error fetching members:', error);
      setError('Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberChange = (index, field, value) => {
    const member = members[index];

    // Check if trying to change playerId of an existing member
    if (field === 'playerId' && member._id && originalPlayerIds[member._id]) {
      const originalId = originalPlayerIds[member._id];
      if (value !== originalId && value !== '') {
        // Show warning dialog
        setWarningDialog({ open: true, index, newValue: value });
        return;
      }
    }

    const newMembers = [...members];
    newMembers[index] = {
      ...newMembers[index],
      [field]: value
    };
    setMembers(newMembers);
  };

  const handleWarningDialogClose = () => {
    setWarningDialog({ open: false, index: null, newValue: '' });
  };

  const clearRow = (index) => {
    const newMembers = [...members];

    if (newMembers[index]._id) {
      if (window.confirm('Delete this member completely?')) {
        deleteMember(newMembers[index]._id, index);
      }
    } else {
      newMembers[index] = {
        playerName: '',
        playerId: '',
        phoneNumber: '',
        email: '',
        role: '',
        discordNickname: '',
        isExisting: false
      };
      setMembers(newMembers);
    }
  };

  const deleteMember = async (id, index) => {
    try {
      await api.members.delete(id);
      // Clear locally
      const newMembers = [...members];
      newMembers[index] = {
        playerName: '',
        playerId: '',
        phoneNumber: '',
        discordNickname: '',
        isExisting: false
      };
      setMembers(newMembers);
      setMessage('Member deleted');
    } catch (err) {
      setError('Failed to delete member');
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    // Filter out completely empty rows, but keep valid ones
    const membersToSave = members.filter(m =>
      (m.playerName && m.playerId) // Basic validation
    );

    if (membersToSave.length === 0 && members.some(m => m._id)) {
      // Warning: Saving 0 members?
    }

    try {
      const response = await api.members.bulkUpdate(selectedClan, membersToSave);

      setMessage(`Saved! Created: ${response.results?.created || 0}, Updated: ${response.results?.updated || 0}`);
      if (response.results?.errors?.length > 0) {
        setError('Some errors occurred: ' + response.results.errors.join(', '));
      }

      // Refresh to get new IDs and sorted order
      fetchMembers();
    } catch (error) {
      setError(error.message || 'Failed to save members');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Clan Roster (Max 40)
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            select
            label="Select Clan"
            value={selectedClan}
            onChange={(e) => setSelectedClan(e.target.value)}
            sx={{ width: 200 }}
            size="small"
          >
            {clans.map((clan) => (
              <MenuItem key={clan._id} value={clan._id}>
                {clan.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Info note about member replacement */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          ⚠️ Replacing Clan Members
        </Typography>
        <Typography variant="body2">
          To replace a member who leaves the clan with a new one:
        </Typography>
        <Typography variant="body2" component="ol" sx={{ m: 0, pl: 2 }}>
          <li><strong>Delete</strong> the old member (🗑️ button)</li>
          <li><strong>Create</strong> the new member in an empty row</li>
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
          This preserves the old player's historical results separate from the new one.
        </Typography>
      </Alert>

      {/* Warning dialog for playerId change */}
      <Dialog open={warningDialog.open} onClose={handleWarningDialogClose}>
        <DialogTitle>⚠️ Warning: Game ID Change</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are trying to modify the <strong>Game ID</strong> of an existing member.
            <br /><br />
            <strong>This is not recommended</strong> because historical results would
            remain associated with the old player.
            <br /><br />
            If you want to replace a clan member:
            <ol>
              <li>Click <strong>Cancel</strong></li>
              <li><strong>Delete</strong> the current member (🗑️ button)</li>
              <li><strong>Create</strong> the new member in an empty row</li>
            </ol>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleWarningDialogClose} variant="contained">
            Cancel (Recommended)
          </Button>
        </DialogActions>
      </Dialog>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ p: 2, overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr 1fr 50px', gap: 1, alignItems: 'center', mb: 1, fontWeight: 'bold', px: 1 }}>
            <Box>#</Box>
            <Box>Nickname *</Box>
            <Box>Game ID *</Box>
            <Box>Email</Box>
            <Box>Ruolo</Box>
            <Box>Phone</Box>
            <Box>Actions</Box>
          </Box>

          {members.map((member, index) => {
            return (
              <Box key={member._id || `slot-${index}`} sx={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 1fr 1fr 1fr 50px',
                gap: 1,
                alignItems: 'center',
                bgcolor: index % 2 === 0 ? 'action.hover' : 'background.paper',
                p: 1,
                borderRadius: 1
              }}>
                <Typography variant="body2" color="text.secondary">{index + 1}</Typography>
                <TextField
                  size="small"
                  value={member.playerName}
                  onChange={(e) => handleMemberChange(index, 'playerName', e.target.value)}
                  placeholder="Nickname"
                  fullWidth
                />
                <TextField
                  size="small"
                  value={member.playerId}
                  onChange={(e) => handleMemberChange(index, 'playerId', e.target.value)}
                  placeholder="Game ID"
                  fullWidth
                />
                <TextField
                  size="small"
                  type="email"
                  value={member.email || ''}
                  onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                  placeholder="Email"
                  fullWidth
                />
                <TextField
                  select
                  size="small"
                  value={member.role || ''}
                  onChange={(e) => handleMemberChange(index, 'role', e.target.value)}
                  fullWidth
                >
                  <MenuItem value="">-</MenuItem>
                  <MenuItem value="uploader">Uploader</MenuItem>
                  <MenuItem value="viewer">Viewer</MenuItem>
                  <MenuItem value="editor">Editor</MenuItem>
                </TextField>
                <TextField
                  size="small"
                  value={member.phoneNumber || ''}
                  onChange={(e) => handleMemberChange(index, 'phoneNumber', e.target.value)}
                  placeholder="Phone"
                  fullWidth
                />
                <Box>
                  {(member.playerName || member.playerId) && (
                    <Button
                      size="small"
                      color="error"
                      sx={{ minWidth: 30 }}
                      onClick={() => clearRow(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })}
        </Paper>
      )}
    </Container>
  );
};

export default MemberManagement;
