const axios = require('axios');
const jwt = require('jsonwebtoken');

// Load service account either from FIREBASE_CREDS env var (JSON string)
// or fall back to the local firebase-credentials.json file.
let serviceAccount;
if (process.env.FIREBASE_CREDS) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDS);
  } catch (err) {
    console.error('Failed to parse FIREBASE_CREDS env var:', err);
    throw err;
  }
} else {
  serviceAccount = require('../firebase-credentials.json');
}

class VisionOCRService {
  static async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });

    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token
    });

    return response.data.access_token;
  }

  // Google Cloud Vision API - più accurato per testo da giochi
  static async extractTextFromImage(imagePath) {
    try {
      // Convert image to base64
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Get access token from service account
      const accessToken = await VisionOCRService.getAccessToken();

      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate`,
        {
          requests: [{
            image: {
              content: base64Image
            },
            features: [{
              type: 'TEXT_DETECTION',
              maxResults: 50
            }]
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.responses[0].fullTextAnnotation.text;
    } catch (error) {
      console.error('Google Vision OCR Error:', error);
      throw new Error('Failed to extract text with Google Vision');
    }
  }
}

module.exports = VisionOCRService;
