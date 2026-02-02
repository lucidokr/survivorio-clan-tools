const axios = require('axios');
const fs = require('fs');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const serviceAccount = require('../firebase-credentials.json');

class CoordinateOCRService {
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
  static async extractTextFromImage(imagePath, coordinates = null) {
    try {
      if (coordinates) {
        return await this.extractWithCoordinates(imagePath, coordinates);
      } else {
        return await this.extractFullImage(imagePath);
      }
    } catch (error) {
      console.error('Coordinate OCR Error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  static async extractWithCoordinates(imagePath, coordinates) {
    try {
      console.log('Using Google Vision API with coordinates...');

      // For now, use full image OCR and we'll parse coordinates in the text
      // Google Vision API doesn't support cropHints in the way we're using it
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Get access token from service account
      const accessToken = await CoordinateOCRService.getAccessToken();

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

      const text = response.data.responses[0].fullTextAnnotation.text;
      return {
        text: text,
        fullResponse: response.data.responses[0]
      };
    } catch (error) {
      console.error('Coordinate OCR Error:', error);
      throw new Error('Failed to extract text with coordinates');
    }
  }

  static async extractFullImage(imagePath) {
    try {
      console.log('Using Google Vision API for full image...');

      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Get access token from service account
      const accessToken = await CoordinateOCRService.getAccessToken();

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

      const text = response.data.responses[0].fullTextAnnotation.text;
      return {
        text: text,
        fullResponse: response.data.responses[0]
      };
    } catch (error) {
      console.error('Full Image OCR Error:', error);
      throw new Error('Failed to extract text from full image');
    }
  }

  static parseMemberResultsFromCoordinates(text, clanTag) {
    const lines = text.split('\n').filter(line => line.trim());
    const results = [];

    console.log('Parsing members from coordinates:', text);

    // Enhanced parsing for coordinate-based extraction
    for (const line of lines) {
      const cleanLine = line
        .replace(/[^\w\s\.\-_·LvATKUTC0-9:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Pattern for: Name Score
      const match = cleanLine.match(/([A-Za-z0-9\s\.\-_]{2,20})\s+([0-9]{3,5})/);

      if (match) {
        let playerName = match[1].trim();
        const score = parseInt(match[2]);

        // Clean player name
        playerName = playerName.replace(/UTC/g, '').trim();
        playerName = playerName.replace(/\s+/g, ' ').trim();

        console.log(`Coordinate extraction - Name: "${playerName}", Score: ${score}`);

        if (playerName.length >= 3 && playerName.length <= 20 &&
          score >= 50 && score <= 99999 &&
          !playerName.match(/^\d+$/) &&
          !playerName.includes('Member') &&
          !playerName.includes('Clan') &&
          !playerName.includes('Lv.') &&
          !playerName.includes('ATK') &&
          !playerName.includes('ID')) {

          results.push({
            playerName: playerName,
            score: score
          });
        }
      }
    }

    console.log(`Coordinate parsing found ${results.length} valid members`);
    return results;
  }

  static async getMemberListCoordinates(imagePath) {
    try {
      // Get real image dimensions using sharp
      const metadata = await sharp(imagePath).metadata();
      const imageWidth = metadata.width;
      const imageHeight = metadata.height;

      console.log(`Image dimensions: ${imageWidth}x${imageHeight}`);

      // Coordinates: 40% from top, 0% from left, max width and height
      return [
        {
          x: 0,                              // 0% from left (start from left edge)
          y: Math.floor(imageHeight * 0.4),   // 40% from top
          width: imageWidth,                  // 100% width (max width)
          height: Math.floor(imageHeight * 0.6) // 60% height (from 40% to bottom)
        }
      ];
    } catch (error) {
      console.error('Error getting image dimensions:', error);
      // Fallback to default dimensions (assuming 1080x1920 mobile)
      return [
        {
          x: 0,        // 0% from left
          y: 768,      // 40% of 1920
          width: 1080,  // 100% width
          height: 1152 // 60% of 1920
        }
      ];
    }
  }

  static parseClanMembersFromCoordinates(text, clanTag, visionData = null) {
    const lines = text.split('\n').filter(line => line.trim());
    const members = [];

    console.log('Parsing clan members from coordinates:', text);

    // If we have vision data with boundingPoly, use it for precise filtering
    if (visionData && visionData.textAnnotations) {
      console.log('Using boundingPoly coordinates for precise member extraction...');

      // Get image dimensions from vision data
      const imageWidth = visionData.fullTextAnnotation.pages[0].width;
      const imageHeight = visionData.fullTextAnnotation.pages[0].height;

      console.log(`Image dimensions from vision: ${imageWidth}x${imageHeight}`);

      // Filter text annotations by X and Y position
      const memberTexts = visionData.textAnnotations
        .filter(annotation => {
          if (!annotation.boundingPoly || !annotation.boundingPoly.vertices) return false;

          // Get X and Y positions (top-left corner of text)
          const x = annotation.boundingPoly.vertices[0].x || 0;
          const y = annotation.boundingPoly.vertices[0].y || 0;

          // Check if Y is in member list area (from 15% to 85% of image height)
          const yMin = imageHeight * 0.15; // Start from 15% down
          const yMax = imageHeight * 0.85; // Up to 85% down
          const yInRange = y >= yMin && y <= yMax;

          // Check if X is in reasonable range (not too far right for roles)
          const xMax = imageWidth * 0.30; // Max 30% from left
          const xInRange = x <= xMax;

          console.log(`Text "${annotation.description}" at X:${x}, Y:${y} - XInRange: ${xInRange}, YInRange: ${yInRange}`);

          return xInRange && yInRange;
        })
        .map(annotation => annotation.description)
        .filter(text => {
          const cleanText = text.trim();
          console.log(`Filtering text: "${cleanText}" - Length: ${cleanText.length}`);
          console.log(`  - Contains Clan: ${cleanText.includes('Clan')}`);
          console.log(`  - Contains Member: ${cleanText.includes('Member')}`);
          console.log(`  - Contains Lv.: ${cleanText.includes('Lv.')}`);
          console.log(`  - Contains ATK: ${cleanText.includes('ATK')}`);
          console.log(`  - Contains Online: ${cleanText.includes('Online')}`);
          console.log(`  - Contains Vice: ${cleanText.includes('Vice')}`);
          console.log(`  - Contains Leader: ${cleanText.includes('Leader')}`);
          console.log(`  - Contains Role: ${cleanText.includes('Role')}`);
          console.log(`  - Is pure numbers: ${cleanText.match(/^\d+$/)}`);
          console.log(`  - Length check: ${cleanText.length >= 3 && cleanText.length <= 20}`);

          const passes = cleanText.length >= 3 &&
            cleanText.length <= 20 &&
            !cleanText.includes('Clan') &&
            !cleanText.includes('Member') &&
            !cleanText.includes('Lv.') &&
            !cleanText.includes('ATK') &&
            !cleanText.includes('Online') &&
            !cleanText.includes('Vice') &&
            !cleanText.includes('Leader') &&
            !cleanText.includes('Role') &&
            !cleanText.match(/^\d+$/);

          console.log(`  - Final result: ${passes}`);
          return passes;
        });

      console.log('Found potential member texts:', memberTexts);

      // Process each member text directly from boundingPoly
      for (const memberText of memberTexts) {
        console.log(`Processing memberText: "${memberText}"`);

        // Use the text directly from boundingPoly (no need to search in OCR)
        let playerName = memberText.replace(/UTC/g, '').replace(/\s+/g, ' ').trim();
        playerName = playerName.replace(/^-+$/g, '').trim();
        playerName = playerName.replace(/^-+|-+$/g, '').trim();

        // Skip empty player names
        if (!playerName || playerName.length === 0) {
          console.log(`Skipping empty player name from: "${memberText}"`);
          continue;
        }

        console.log(`Processing member from boundingPoly: "${playerName}"`);

        // Look for level and ATK in the full OCR text starting from this member
        let level = 0;
        let atk = 0;

        // Find the member in OCR lines to get level/ATK
        const memberIndex = lines.findIndex(line => {
          const cleanLine = line.replace(/UTC/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

          // Only match if the line contains the full player name or a substantial part
          if (cleanLine.includes(playerName)) {
            return true;
          }

          // Only check partial match if it's at least 3 characters and makes sense
          const firstWord = cleanLine.split(' ')[0];
          if (firstWord.length >= 3 && playerName.toLowerCase().startsWith(firstWord.toLowerCase())) {
            return true;
          }

          return false;
        });

        if (memberIndex !== -1) {
          console.log(`Found member at OCR line ${memberIndex}: "${lines[memberIndex]}"`);

          for (let j = memberIndex + 1; j < Math.min(memberIndex + 15, lines.length); j++) {
            const nextLine = lines[j].trim();
            console.log(`  Checking line ${j} for level/ATK: "${nextLine}"`);

            if (nextLine.includes('Lv.') && !level) {
              const levelMatch = nextLine.match(/Lv\.?\s*([0-9]{1,3})/);
              if (levelMatch) {
                level = parseInt(levelMatch[1]);
                console.log(`Found level: ${level} for ${playerName}`);
              }
            }

            // Also accept pure numbers as level (1-3 digits)
            if (!level && nextLine.match(/^[0-9]{1,3}$/)) {
              level = parseInt(nextLine);
              console.log(`Found pure number level: ${level} for ${playerName}`);
            }

            if (nextLine.includes('ATK') && !atk) {
              const atkMatch = nextLine.match(/ATK\s*([0-9]{3,7})/);
              if (atkMatch) {
                atk = parseInt(atkMatch[1]);
                console.log(`Found ATK: ${atk} for ${playerName}`);
              }
            }

            // Also look for pure large numbers that could be ATK (6-7 digits)
            if (!atk && nextLine.match(/^[0-9]{6,7}$/)) {
              atk = parseInt(nextLine);
              console.log(`Found potential ATK number: ${atk} for ${playerName}`);
            }

            if (level > 0 && atk > 0) break;
          }

          console.log(`After search - Level: ${level}, ATK: ${atk}`);
        }

        if (level > 0) {
          members.push({
            playerName: playerName,
            level: level,
            atk: atk
          });
          console.log(`Added member: ${playerName} Lv.${level} ATK:${atk}`);
        } else {
          console.log(`No level found for ${playerName}, skipping`);
        }
      }
    } else {
      // Fallback to line-by-line extraction
      console.log('Using line-by-line extraction (no vision data)...');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if ((line.includes('UTC') || /^[A-Za-z][A-Za-z0-9\s\-_]{2,20}$/.test(line)) &&
          !line.includes('Clan') &&
          !line.includes('Leader') &&
          !line.includes('Vice') &&
          !line.includes('Member') &&
          !line.includes('Points') &&
          !line.includes('Total') &&
          !line.includes('Manage')) {

          let playerName = line.replace(/UTC/g, '').replace(/\s+/g, ' ').trim();
          playerName = playerName.replace(/^-+$/g, '').trim();
          playerName = playerName.replace(/^-+|-+$/g, '').trim();

          if (playerName.length < 3 || playerName.length > 20) continue;

          if (playerName.includes('Member') ||
            playerName.includes('Clan') ||
            playerName.includes('Leader') ||
            playerName.includes('Vice') ||
            playerName.includes('Points') ||
            playerName.includes('Total') ||
            playerName.includes('Manage') ||
            playerName.includes('Settings') ||
            playerName.includes('Emblem') ||
            playerName.includes('Perks') ||
            playerName.includes('XP') ||
            playerName.includes('Apply') ||
            playerName.includes('Recruit') ||
            playerName.includes('whats') ||
            playerName.match(/^[0-9]+$/) ||
            playerName.match(/^[A-Z]+$/)) continue;

          console.log(`Found potential player: "${playerName}" at line ${i}`);

          let level = 0;
          let atk = 0;

          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const nextLine = lines[j].trim();

            if (nextLine.includes('Lv.') && !level) {
              const levelMatch = nextLine.match(/Lv\.?\s*([0-9]{1,3})/);
              if (levelMatch) {
                level = parseInt(levelMatch[1]);
                console.log(`Found level: ${level} for ${playerName}`);
              }
            }

            if (nextLine.includes('ATK') && !atk) {
              const atkMatch = nextLine.match(/ATK\s*([0-9]{3,7})/);
              if (atkMatch) {
                atk = parseInt(atkMatch[1]);
                console.log(`Found ATK: ${atk} for ${playerName}`);
              }
            }

            if (level > 0 && atk > 0) break;
          }

          if (level > 0) {
            members.push({
              playerName: playerName,
              level: level,
              atk: atk
            });
            console.log(`Added member: ${playerName} Lv.${level} ATK:${atk}`);
          }
        }
      }
    }

    console.log(`Coordinate member parsing found ${members.length} members`);
    members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.playerName}: Lv.${member.level} ATK:${member.atk}`);
    });

    return members;
  }
}

module.exports = CoordinateOCRService;
