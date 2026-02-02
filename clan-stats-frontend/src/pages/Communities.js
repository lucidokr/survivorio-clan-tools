import React, { useEffect, useState } from 'react';
import { Container, Card, CardContent, Typography, Button, Box, TextField, MenuItem, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const ADMIN_EMAIL = 'lucido.kristian@gmail.com';

const Communities = () => {
    const { user } = useAuth();
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchCommunities();
    }, []);

    const fetchCommunities = async () => {
        try {
            setLoading(true);
            const comms = await api.community.getAll();
            setCommunities(comms || []);
        } catch (e) {
            console.error('Failed to fetch communities', e);
            setError('Failed to fetch communities');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!name) return setError('Name required');
        setCreating(true);
        setError('');
        try {
            await api.community.create({ name });
            setMessage('Community created');
            setName('');
            fetchCommunities();
        } catch (e) {
            console.error('Create failed', e);
            setError(e.message || 'Failed to create community');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this community?')) return;
        try {
            await api.community.delete(id);
            setMessage('Community deleted');
            fetchCommunities();
        } catch (e) {
            console.error('Delete failed', e);
            setError(e.message || 'Failed to delete community');
        }
    };

    if (loading) return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="240px"><CircularProgress /></Box>
        </Container>
    );

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Communities</Typography>

            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {user?.email === ADMIN_EMAIL && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6">Create Community (admin)</Typography>
                        <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
                            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
                            <Button variant="contained" onClick={handleCreate} disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {communities.map(c => (
                <Card key={c.id} sx={{ mb: 2 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="h6">{c.name}</Typography>
                                <Typography variant="body2" color="text.secondary">{c.description || ''}</Typography>
                                <Typography variant="caption" color="text.secondary">Clans: {(c.clanIds || []).length}</Typography>
                            </Box>

                            <Box>
                                {user?.email === ADMIN_EMAIL && (
                                    <Button color="error" variant="outlined" onClick={() => handleDelete(c.id)}>Delete</Button>
                                )}
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            ))}
        </Container>
    );
};

export default Communities;
