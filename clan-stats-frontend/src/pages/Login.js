/**
 * Login Page Component
 * Handles Google OAuth authentication
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Paper,
    Typography,
    Button,
    Box,
    CircularProgress,
    Alert
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Redirect if already authenticated
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/');
        }
    }, [isAuthenticated, navigate]);

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError(null);
            await login();
            navigate('/');
        } catch (err) {
            console.error('Login failed:', err);
            setError(err.message || 'Failed to sign in. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
                    🎮 Clan Stats
                </Typography>

                <Typography variant="h6" color="textSecondary" gutterBottom>
                    Accedi per gestire i tuoi clan
                </Typography>

                <Typography variant="body2" color="textSecondary" sx={{ mb: 4 }}>
                    Usa il tuo account Google per accedere e iniziare a monitorare
                    le statistiche del tuo clan.
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                <Box sx={{ mt: 4 }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        sx={{
                            backgroundColor: '#4285F4',
                            '&:hover': {
                                backgroundColor: '#357ABD'
                            },
                            py: 1.5,
                            px: 4
                        }}
                    >
                        {loading ? 'Accesso in corso...' : 'Accedi con Google'}
                    </Button>
                </Box>

                <Typography variant="caption" color="textSecondary" sx={{ mt: 4, display: 'block' }}>
                    Effettuando l'accesso, accetti i termini di servizio e la privacy policy.
                </Typography>
            </Paper>
        </Container>
    );
};

export default Login;
