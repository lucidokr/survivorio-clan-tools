/**
 * Authentication Context Provider
 * Manages user authentication state across the app
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, signInWithGoogle, logOut, getIdToken } from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthChange(async (firebaseUser) => {
            if (firebaseUser) {
                // User is signed in
                const idToken = await getIdToken();
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName,
                    picture: firebaseUser.photoURL
                });
                setToken(idToken);

                // Store token in localStorage for API calls
                localStorage.setItem('authToken', idToken);
            } else {
                // User is signed out
                setUser(null);
                setToken(null);
                localStorage.removeItem('authToken');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            setLoading(true);
            const result = await signInWithGoogle();
            const idToken = await result.user.getIdToken();
            setToken(idToken);
            localStorage.setItem('authToken', idToken);

            // Sync with backend
            await syncUserWithBackend(idToken);

            return result.user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await logOut();
            setUser(null);
            setToken(null);
            localStorage.removeItem('authToken');
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    const refreshToken = async () => {
        const newToken = await getIdToken();
        setToken(newToken);
        localStorage.setItem('authToken', newToken);
        return newToken;
    };

    const syncUserWithBackend = async (idToken) => {
        try {
            const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            await fetch(`${API_URL}/api/auth/sync`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Failed to sync user with backend:', error);
        }
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout,
        refreshToken,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
