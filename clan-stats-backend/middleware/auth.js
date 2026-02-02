/**
 * Authentication Middleware
 * Verifies Firebase ID tokens from Google OAuth
 */

const { admin } = require('../services/firebaseService');

/**
 * Middleware to verify Firebase ID token
 * Extracts user info and attaches to req.user
 */
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided. Please include Authorization header with Bearer token.'
        });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        // Verify the ID token using Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split('@')[0],
            picture: decodedToken.picture || null,
            emailVerified: decodedToken.email_verified || false
        };

        next();
    } catch (error) {
        console.error('Token verification error:', error.code, error.message);

        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please sign in again.'
            });
        }

        if (error.code === 'auth/argument-error') {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'The provided token is invalid.'
            });
        }

        return res.status(401).json({
            error: 'Authentication failed',
            message: 'Unable to verify your identity.'
        });
    }
};

/**
 * Optional auth middleware - doesn't fail if no token, just sets req.user to null
 */
const optionalAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split('@')[0],
            picture: decodedToken.picture || null,
            emailVerified: decodedToken.email_verified || false
        };
    } catch (error) {
        req.user = null;
    }

    next();
};

module.exports = { authMiddleware, optionalAuthMiddleware };
