import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import axios from 'axios';

const MembersManualImport = () => {
  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState('');
  const [members, setMembers] = useState([
    { name: '', level: '', atk: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    fetchClans();
  }, []);

  const fetchClans = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/clan');
      setClans(response.data);
      if (response.data.length > 0) {
        setSelectedClan(response.data[0]._id);
      }
    } catch (error) {
      console.error('Error fetching clans:', error);
    }
  };

  const addMemberRow = () => {
    setMembers([...members, { name: '', level: '', atk: '' }]);
  };

  const removeMemberRow = (index) => {
    const newMembers = members.filter((_, i) => i !== index);
    setMembers(newMembers.length > 0 ? newMembers : [{ name: '', level: '', atk: '' }]);
  };

  const updateMember = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
  };

  const handlePreview = () => {
    const validMembers = members.filter(m =>
      m.name.trim() &&
      m.level.trim() &&
      m.atk.trim() &&
      parseInt(m.level) > 0 &&
      parseInt(m.atk) > 0
    );

    if (validMembers.length === 0) {
      setError('Please add at least one valid member');
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const validMembers = members.filter(m =>
      m.name.trim() &&
      m.level.trim() &&
      m.atk.trim() &&
      parseInt(m.level) > 0 &&
      parseInt(m.atk) > 0
    ).map(m => ({
      name: m.name.trim(),
      level: parseInt(m.level),
      atk: parseInt(m.atk.replace(/,/g, '')),
      playerId: m.name.trim().toLowerCase().replace(/\s+/g, '_')
    }));

    try {
      const response = await axios.post('http://localhost:5000/api/members-import/import', {
        clanId: selectedClan,
        members: validMembers
      });

      setMessage(`Successfully imported ${response.data.imported.length} members!`);
      setShowConfirmDialog(false);
      setMembers([{ name: '', level: '', atk: '' }]);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to import members');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Manual Members Import
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add Members Manually
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Since OCR is not working well with game screenshots, you can add members manually here.
            Enter the member details from your screenshot.
          </Typography>

          <TextField
            select
            label="Select Clan"
            value={selectedClan}
            onChange={(e) => setSelectedClan(e.target.value)}
            fullWidth
            SelectProps={{ native: true }}
            sx={{ mb: 3 }}
          >
            {clans.map((clan) => (
              <option key={clan._id} value={clan._id}>
                {clan.name}
              </option>
            ))}
          </TextField>

          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Member Name</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>ATK</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        fullWidth
                        value={member.name}
                        onChange={(e) => updateMember(index, 'name', e.target.value)}
                        placeholder="e.g., Awimbawe"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        type="number"
                        value={member.level}
                        onChange={(e) => updateMember(index, 'level', e.target.value)}
                        placeholder="150"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        value={member.atk}
                        onChange={(e) => updateMember(index, 'atk', e.target.value)}
                        placeholder="1,417,049"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton onClick={() => removeMemberRow(index)} color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={addMemberRow}
            >
              Add Member Row
            </Button>
            <Button
              variant="contained"
              onClick={handlePreview}
              disabled={!selectedClan}
            >
              Preview Import
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Ready to import {members.filter(m => m.name.trim() && m.level.trim() && m.atk.trim()).length} members:
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>ATK</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.filter(m => m.name.trim() && m.level.trim() && m.atk.trim()).map((member, index) => (
                  <TableRow key={index}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.level}</TableCell>
                    <TableCell>{member.atk}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleImport} variant="contained" disabled={loading}>
            Import Members
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MembersManualImport;
