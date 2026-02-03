import React, { useState } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import api from '../services/api';

const ClanRegistration = () => {
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await api.clan.register({
        name: formData.name,
        tag: formData.tag,
        description: formData.description
      });

      setMessage('Clan registered successfully!');
      setFormData({ name: '', tag: '', description: '' });
    } catch (error) {
      setError(error.message || 'Failed to register clan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Register Your Clan
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="body1" paragraph>
            Register your clan by providing the details below. Any authenticated user can create a clan and becomes its owner.
          </Typography>

          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Clan Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              margin="normal"
            />

            <TextField
              fullWidth
              label="Clan Tag"
              name="tag"
              value={formData.tag}
              onChange={handleChange}
              required
              margin="normal"
              helperText="This will be used to identify and remove clan tags from member names"
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              name="description"
              value={formData.description}
              onChange={handleChange}
              margin="normal"
              multiline
              rows={3}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !formData.name || !formData.tag}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Register Clan'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default ClanRegistration;
