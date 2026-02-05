import React, { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  People
} from '@mui/material';
import { CloudUpload, Visibility, Group } from '@mui/icons-material';
import axios from 'axios';

const MembersImport = () => {
  const [clans, setClans] = useState([]);
  const [selectedClan, setSelectedClan] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [useCoordinates, setUseCoordinates] = useState(true);
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

  const handleFileChange = (e) => {
    setScreenshot(e.target.files[0]);
    setPreviewData(null);
    setMessage('');
    setError('');
  };

  const handlePreview = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('screenshot', screenshot);
    formData.append('clanId', selectedClan);
    formData.append('useCoordinates', useCoordinates);

    try {
      const response = await axios.post(
        'http://localhost:5000/api/members-import/preview',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setPreviewData(response.data);
      setShowConfirmDialog(true);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to process screenshot');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('http://localhost:5000/api/members-import/import', {
        clanId: selectedClan,
        members: previewData.newMembers
      });

      setMessage(`Successfully imported ${response.data.imported.length} members!`);
      setShowConfirmDialog(false);
      setPreviewData(null);
      setScreenshot(null);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to import members');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Import Members from Screenshot
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Upload Clan Members Screenshot
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Upload a screenshot of your clan member list to extract member names, levels, and ATK values.
            The system will use Google Vision API to extract text from the screenshot.
          </Typography>

          <Box component="form" onSubmit={(e) => { e.preventDefault(); handlePreview(); }}>
            <FormControlLabel
              control={
                <Switch
                  checked={useCoordinates}
                  onChange={(e) => setUseCoordinates(e.target.checked)}
                  color="primary"
                />
              }
              label="Use smart coordinates (recommended)"
              sx={{ mb: 2 }}
            />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {useCoordinates
                ? "🎯 Smart coordinates: Focuses on the member list area for better accuracy"
                : "📄 Full image: Processes the entire screenshot (may include extra text)"
              }
            </Typography>

            <TextField
              select
              label="Select Clan"
              value={selectedClan}
              onChange={(e) => setSelectedClan(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              SelectProps={{ native: true }}
            >
              {clans.map((clan) => (
                <option key={clan._id} value={clan._id}>
                  {clan.name}
                </option>
              ))}
            </TextField>

            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 2 }}
              startIcon={<CloudUpload />}
            >
              Select Screenshot
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileChange}
                required
              />
            </Button>

            {screenshot && (
              <Typography variant="body2" sx={{ mb: 2 }}>
                Selected: {screenshot.name}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !screenshot || !selectedClan}
              startIcon={<Visibility />}
            >
              {loading ? 'Processing...' : 'Preview Members'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Import Preview - {previewData?.totalFound} Members Found
        </DialogTitle>
        <DialogContent>
          {previewData && (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Chip
                  label={`${(previewData.newMembers || []).length} New Members`}
                  color="success"
                  sx={{ mr: 1 }}
                />
                <Chip
                  label={`${(previewData.existingMembers || []).length} Already Exist`}
                  color="warning"
                />
              </Box>

              {(previewData.newMembers || []).length > 0 && (
                <TableContainer component={Paper} sx={{ mb: 2, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>ATK</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(previewData.newMembers || []).slice(0, 10).map((member, index) => (
                        <TableRow key={index}>
                          <TableCell>{member.playerName || member.name}</TableCell>
                          <TableCell>{member.level}</TableCell>
                          <TableCell>{member.atk.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {(previewData.newMembers || []).length > 10 && (
                        <TableRow>
                          <TableCell colSpan={3} align="center">
                            ... and {(previewData.newMembers || []).length - 10} more
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {(previewData.existingMembers || []).length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {(previewData.existingMembers || []).length} members already exist and will be skipped.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={loading || (previewData?.newMembers || []).length === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <Group />}
          >
            Import {(previewData?.newMembers || []).length} Members
          </Button>
        </DialogActions>
      </Dialog>
    </Container >
  );
};

export default MembersImport;
