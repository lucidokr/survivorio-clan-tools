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
    CircularProgress,
    MenuItem,
    Divider,
    Chip
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const MyClan = () => {
    const { user } = useAuth();
    const [clans, setClans] = useState([]);
    const [selectedClanId, setSelectedClanId] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        tag: '',
        description: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [selectedClan, setSelectedClan] = useState(null);
    const [communities, setCommunities] = useState([]);
    const [selectedCommunityId, setSelectedCommunityId] = useState('');

    useEffect(() => {
        fetchClans();
    }, []);

    useEffect(() => {
        if (selectedClanId) {
            const clan = clans.find(c => c._id === selectedClanId);
            if (clan) {
                setSelectedClan(clan);
                setFormData({
                    name: clan.name || '',
                    tag: clan.tag || '',
                    description: clan.description || ''
                });
            }
        }
    }, [selectedClanId, clans]);

    useEffect(() => {
        // when communities or selected clan changes, pick a community that contains the clan (if any)
        if (selectedClan && communities.length > 0) {
            const found = communities.find(c => {
                const ids = c.clanIds || [];
                return ids.includes(selectedClan._id) || ids.includes(selectedClan.id) || ids.includes(selectedClan.clanId);
            });
            if (found) {
                setSelectedCommunityId(found.id);
            } else {
                setSelectedCommunityId('');
            }
        } else if (!selectedClan) {
            setSelectedCommunityId('');
        }
    }, [selectedClan, communities]);

    // Auto-clear messages
    useEffect(() => {
        if (message || error) {
            const timer = setTimeout(() => {
                setMessage('');
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message, error]);

    const fetchClans = async () => {
        try {
            setLoading(true);
            const response = await api.clan.getMyClans();
            setClans(response);
            if (response.length > 0) {
                setSelectedClanId(response[0]._id);
            }
            // fetch communities
            try {
                const comms = await api.community.getAll();
                setCommunities(comms);
            } catch (e) {
                console.warn('Failed to fetch communities', e);
            }
        } catch (err) {
            console.error('Error fetching clans:', err);
            setError('Failed to fetch clans');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedClanId) {
            setError('No clan selected');
            return;
        }

        // Only owners can edit
        if (selectedClan?.myRole && selectedClan.myRole !== 'owner') {
            setError('Only clan owners can edit clan details');
            return;
        }

        setSaving(true);
        setError('');
        setMessage('');

        try {
            await api.clan.update(selectedClanId, formData);
            setMessage('Clan updated successfully!');

            // Refresh clans list
            fetchClans();
        } catch (err) {
            setError(err.message || 'Failed to update clan');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    const isOwner = !selectedClan?.myRole || selectedClan.myRole === 'owner';

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                My Clan Settings
            </Typography>
            <Box sx={{ mb: 2 }}>
                <Button variant="outlined" href="/register-clan">Register New Clan</Button>
            </Box>

            {clans.length === 0 ? (
                <Card>
                    <CardContent>
                        <Typography variant="body1">
                            You don't have any clans yet. Register a new clan to get started.
                        </Typography>
                        <Button
                            variant="contained"
                            href="/register-clan"
                            sx={{ mt: 2 }}
                        >
                            Register New Clan
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent>
                        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        {/* Clan Selector */}
                        {clans.length > 1 && (
                            <TextField
                                select
                                fullWidth
                                label="Select Clan"
                                value={selectedClanId}
                                onChange={(e) => setSelectedClanId(e.target.value)}
                                margin="normal"
                            >
                                {clans.map((clan) => (
                                    <MenuItem key={clan._id} value={clan._id}>
                                        {clan.name} ({clan.tag})
                                        {clan.myRole && clan.myRole !== 'owner' && ` - ${clan.myRole}`}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}

                        {/* Clan Info Header */}
                        {selectedClan && (
                            <Box sx={{ mt: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="h6">{selectedClan.name}</Typography>
                                <Chip
                                    label={selectedClan.myRole || 'owner'}
                                    color={isOwner ? 'primary' : 'default'}
                                    size="small"
                                />
                                {selectedClan.clanId && (
                                    <Typography variant="body2" color="text.secondary">
                                        ID: {selectedClan.clanId}
                                    </Typography>
                                )}
                                {isOwner && (
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        sx={{ ml: 2 }}
                                        onClick={async () => {
                                            if (!window.confirm('Delete this clan and all its data? This cannot be undone.')) return;
                                            try {
                                                await api.clan.delete(selectedClan._id);
                                                setMessage('Clan deleted');
                                                // refresh clans
                                                await fetchClans();
                                                setSelectedClanId('');
                                            } catch (e) {
                                                setError(e.message || 'Failed to delete clan');
                                            }
                                        }}
                                    >
                                        Delete Clan
                                    </Button>
                                )}
                            </Box>
                        )}

                        {/* Community association */}
                        {selectedClan && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2">Community</Typography>
                                {isOwner ? (
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                                        <TextField
                                            select
                                            size="small"
                                            label="Select Community"
                                            value={selectedCommunityId}
                                            onChange={(e) => setSelectedCommunityId(e.target.value)}
                                            sx={{ minWidth: 240 }}
                                        >
                                            <MenuItem value="">-- none --</MenuItem>
                                            {communities.map(c => (
                                                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                            ))}
                                        </TextField>

                                        <Button
                                            variant="outlined"
                                            onClick={async () => {
                                                if (!selectedCommunityId) return setError('Select a community first');
                                                try {
                                                    await api.community.addClan(selectedCommunityId, selectedClan._id);
                                                    setMessage('Clan associated to community');
                                                    const comms = await api.community.getAll();
                                                    setCommunities(comms);
                                                    // reflect the association in the UI
                                                    setSelectedCommunityId(selectedCommunityId);
                                                } catch (e) {
                                                    setError(e.message || 'Failed to add clan to community');
                                                }
                                            }}
                                        >
                                            Join
                                        </Button>

                                        <Button
                                            variant="outlined"
                                            color="error"
                                            onClick={async () => {
                                                if (!selectedCommunityId) return setError('Select a community first');
                                                try {
                                                    await api.community.removeClan(selectedCommunityId, selectedClan._id);
                                                    setMessage('Clan removed from community');
                                                    const comms = await api.community.getAll();
                                                    setCommunities(comms);
                                                    // reflect the removal in the UI
                                                    setSelectedCommunityId('');
                                                } catch (e) {
                                                    setError(e.message || 'Failed to remove clan from community');
                                                }
                                            }}
                                        >
                                            Leave
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ mt: 1 }}>
                                        <Typography variant="body2">
                                            {selectedCommunityId
                                                ? `This clan is part of: ${(communities.find(c => c.id === selectedCommunityId) || {}).name || 'Unknown'}`
                                                : 'This clan is not part of any community.'}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        )}

                        <Divider sx={{ mb: 3 }} />

                        {/* Admin community management moved to Communities page */}

                        {/* Edit Form - Only for owners */}
                        {isOwner ? (
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
                                    helperText="Used to identify and remove clan tags from member names"
                                />

                                <TextField
                                    fullWidth
                                    label="Description"
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
                                    startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                                    disabled={saving}
                                    sx={{ mt: 3 }}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </Box>
                        ) : (
                            <Alert severity="info">
                                You are a member of this clan with role "{selectedClan?.myRole}".
                                Only the clan owner can edit clan details.
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}
        </Container>
    );
};

export default MyClan;
