import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchClans();
    }
  }, [authLoading, user]);

  const fetchClans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.clan.getMyClans();
      setClans(response);
    } catch (error) {
      console.error('Error fetching clans:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Clan Statistics Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {clans.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Welcome to Clan Stats Tracker!
            </Typography>
            <Typography variant="body1" paragraph>
              You haven't registered any clans yet. Get started by registering your first clan.
            </Typography>
            <Button
              variant="contained"
              component={Link}
              to="/register-clan"
              size="large"
            >
              Register Your First Clan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="contained"
                    component={Link}
                    to="/upload-results"
                    fullWidth
                  >
                    Upload New Results
                  </Button>
                  <Button
                    variant="outlined"
                    component={Link}
                    to="/members"
                    fullWidth
                  >
                    Manage Members
                  </Button>
                  <Button
                    variant="outlined"
                    component={Link}
                    to="/statistics"
                    fullWidth
                  >
                    View Statistics
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Your Clans
                </Typography>
                {clans.map((clan) => {
                  // Handle Firebase timestamp or ISO string
                  let createdDate = '—';
                  if (clan.createdAt) {
                    const timestamp = clan.createdAt._seconds
                      ? new Date(clan.createdAt._seconds * 1000)
                      : new Date(clan.createdAt);
                    if (!isNaN(timestamp.getTime())) {
                      createdDate = timestamp.toLocaleDateString();
                    }
                  }

                  return (
                    <Box
                      key={clan._id}
                      sx={{
                        mb: 2,
                        p: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold">
                        {clan.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tag: {clan.tag}
                        {clan.myRole && (
                          <Box component="span" sx={{
                            ml: 1,
                            px: 1,
                            py: 0.25,
                            bgcolor: clan.myRole === 'owner' ? 'primary.dark' : 'secondary.dark',
                            borderRadius: 1,
                            fontSize: '0.75rem'
                          }}>
                            {clan.myRole}
                          </Box>
                        )}
                      </Typography>
                      {clan.clanId && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          ID: {clan.clanId}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.disabled">
                        Created: {createdDate}
                      </Typography>
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default Dashboard;
