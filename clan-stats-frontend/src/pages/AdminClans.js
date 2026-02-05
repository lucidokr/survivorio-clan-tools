import React, { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Box, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ADMIN_EMAIL = 'lucido.kristian@gmail.com';

const AdminClans = () => {
    const { user } = useAuth();
    const [clans, setClans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) return;
        fetchClans();
    }, [user]);

    const fetchClans = async () => {
        try {
            setLoading(true);
            const data = await api.clan.getAllAdmin();
            setClans(data || []);
        } catch (e) {
            console.error('Failed to fetch clans', e);
            setError(e.message || 'Failed to fetch clans');
        } finally {
            setLoading(false);
        }
    };

    if (!user || user.email !== ADMIN_EMAIL) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">Accesso negato: solo admin</Alert>
            </Container>
        );
    }

    if (loading) return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="240px"><CircularProgress /></Box>
        </Container>
    );

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>All Clans (admin)</Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Tag</TableCell>
                            <TableCell>Owner</TableCell>
                            <TableCell>Active</TableCell>
                            <TableCell>Created At</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {clans.map(c => (
                            <TableRow key={c.id}>
                                <TableCell>{c.name}</TableCell>
                                <TableCell>{c.tag}</TableCell>
                                <TableCell>{c.ownerId || c.ownersEmail || '-'}</TableCell>
                                <TableCell>{c.isActive ? 'Yes' : 'No'}</TableCell>
                                <TableCell>{c.createdAt ? new Date(c.createdAt.seconds ? c.createdAt.seconds * 1000 : c.createdAt).toLocaleString() : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
};

export default AdminClans;
