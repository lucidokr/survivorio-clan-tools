/**
 * Firebase Configuration for Frontend
 * Uses Firebase Auth with Google OAuth
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration - Replace with your actual config from Firebase Console
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "clan-tools-485613.firebaseapp.com",
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "clan-tools-485613",
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "clan-tools-485613.firebasestorage.app",
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
    appId: process.env.REACT_APP_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

/**
 * Sign in with Google popup
 * @returns {Promise<UserCredential>}
 */
export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result;
    } catch (error) {
        console.error('Google sign-in error:', error);
        throw error;
    }
};

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export const logOut = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
};

/**
 * Get the current user's ID token
 * @returns {Promise<string|null>}
 */
export const getIdToken = async () => {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        const token = await user.getIdToken(true); // Force refresh
        return token;
    } catch (error) {
        console.error('Get token error:', error);
        return null;
    }
};

/**
 * Subscribe to auth state changes
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onAuthChange = (callback) => {
    return onAuthStateChanged(auth, callback);
};

export { auth };
export default app;
