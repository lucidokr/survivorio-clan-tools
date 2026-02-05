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
  DialogActions,
  Grid
} from '@mui/material';
import { Add, Delete, Upload } from '@mui/icons-material';
import axios from 'axios';

const ResultsManualImport = () => {
  const [clans, setClans] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedClan, setSelectedClan] = useState('');
  const [week, setWeek] = useState(getCurrentWeek());
  const [results, setResults] = useState([
    { memberName: '', score: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const weekNumber = Math.floor(diff / oneWeek) + 1;
    return `${now.getFullYear()}-${weekNumber.toString().padStart(2, '0')}`;
  }

  useEffect(() => {
    fetchClans();
  }, []);

  useEffect(() => {
    if (selectedClan) {
      fetchMembers();
    }
  }, [selectedClan]);

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

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/members/clan/${selectedClan}`);
      setMembers(response.data);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const addResultRow = () => {
    setResults([...results, { memberName: '', score: '' }]);
  };

  const removeResultRow = (index) => {
    const newResults = results.filter((_, i) => i !== index);
    setResults(newResults.length > 0 ? newResults : [{ memberName: '', score: '' }]);
  };

  const updateResult = (index, field, value) => {
    const newResults = [...results];
    newResults[index][field] = value;
    setResults(newResults);
  };

  const handlePreview = () => {
    const validResults = results.filter(r =>
      r.memberName.trim() &&
      r.score.trim() &&
      parseInt(r.score) > 0
    );

    if (validResults.length === 0) {
      setError('Please add at least one valid result');
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const validResults = results.filter(r =>
      r.memberName.trim() &&
      r.score.trim() &&
      parseInt(r.score) > 0
    );

    try {
      const importPromises = validResults.map(async (result) => {
        // Find member by name
        const member = members.find(m =>
          m.playerName.toLowerCase() === result.memberName.trim().toLowerCase()
        );

        if (!member) {
          throw new Error(`Member "${result.memberName}" not found in clan`);
        }

        return axios.post('http://localhost:5000/api/results/manual', {
          memberId: member._id,
          clanId: selectedClan,
          score: parseInt(result.score),
          week: week
        });
      });

      await Promise.all(importPromises);

      setMessage(`Successfully imported ${validResults.length} results for week ${week}!`);
      setShowConfirmDialog(false);
      setResults([{ memberName: '', score: '' }]);
    } catch (error) {
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Manual Results Import
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Add Weekly Results Manually
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Since OCR is not working well with game screenshots, you can add weekly results manually here.
            Enter member names and scores from your screenshot.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Select Clan"
                value={selectedClan}
                onChange={(e) => setSelectedClan(e.target.value)}
                fullWidth
                SelectProps={{ native: true }}
              >
                {clans.map((clan) => (
                  <option key={clan._id} value={clan._id}>
                    {clan.name}
                  </option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Week"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                fullWidth
                helperText="Format: YYYY-WW"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                Available members: {members.length}
              </Typography>
            </Grid>
          </Grid>

          <TableContainer component={Paper} sx={{ mb: 2, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member Name</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <TextField
                        fullWidth
                        value={result.memberName}
                        onChange={(e) => updateResult(index, 'memberName', e.target.value)}
                        placeholder="e.g., Awimbawe"
                        size="small"
                        select={members.length > 0}
                        SelectProps={{ native: true }}
                      >
                        <option value="">Select member...</option>
                        {members.map((member) => (
                          <option key={member._id} value={member.playerName}>
                            {member.playerName}
                          </option>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        type="number"
                        value={result.score}
                        onChange={(e) => updateResult(index, 'score', e.target.value)}
                        placeholder="1443"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton onClick={() => removeResultRow(index)} color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={addResultRow}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Add Result Row
            </Button>
            <Button
              variant="contained"
              onClick={handlePreview}
              disabled={!selectedClan}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Preview Import
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Preview - Week {week}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Ready to import {results.filter(r => r.memberName.trim() && r.score.trim()).length} results:
          </Typography>
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Member Name</TableCell>
                  <TableCell>Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.filter(r => r.memberName.trim() && r.score.trim()).map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>{result.memberName}</TableCell>
                    <TableCell>{result.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleImport} variant="contained" disabled={loading}>
            Import Results
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ResultsManualImport;
