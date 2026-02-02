const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Load service account either from FIREBASE_CREDS env var (JSON string)
// or fall back to the local firebase-credentials.json file.
let serviceAccount;
if (process.env.FIREBASE_CREDS) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDS);
  } catch (err) {
    console.error('Failed to parse FIREBASE_CREDS env var, falling back to local file:', err);
    try {
      serviceAccount = require('../firebase-credentials.json');
    } catch (e) {
      console.warn('No local firebase-credentials.json found. Relying on Application Default Credentials.');
      serviceAccount = null;
    }
  }
} else {
  try {
    serviceAccount = require('../firebase-credentials.json');
  } catch (err) {
    console.warn('No local firebase-credentials.json found and FIREBASE_CREDS not set. Relying on Application Default Credentials.');
    serviceAccount = null;
  }
}

class OCRService {
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
  static async extractTextFromImage(imagePath, useDocumentDetection = true) {
    try {
      return await this.extractWithGoogleVision(imagePath, useDocumentDetection);
    } catch (error) {
      console.error('OCR Error:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  static async extractWithGoogleVision(imagePath, useDocumentDetection = true) {
    try {
      const detectionType = useDocumentDetection ? 'DOCUMENT_TEXT_DETECTION' : 'TEXT_DETECTION';
      console.log(`Using Google Vision API for OCR with ${detectionType}...`);

      // Convert image to base64
      const buffer = fs.readFileSync(imagePath);
      const base64Image = buffer.toString('base64');

      // Get access token from service account
      const accessToken = await OCRService.getAccessToken();

      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate`,
        {
          requests: [{
            image: {
              content: base64Image
            },
            features: [{
              type: detectionType,
              maxResults: 50,
              model: 'builtin/latest'
            }],
            imageContext: {
              languageHints: ['en', 'it']
            }
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const fullAnnotation = response.data.responses[0].fullTextAnnotation;
      const textAnnotations = response.data.responses[0].textAnnotations || [];

      if (!fullAnnotation && textAnnotations.length === 0) {
        console.log('No text found in image');
        return { text: '', lines: [], textAnnotations: [] };
      }

      // Extract individual lines from structured data
      const lines = [];

      if (fullAnnotation?.pages) {
        for (const page of fullAnnotation.pages) {
          for (const block of page.blocks) {
            for (const paragraph of block.paragraphs) {
              // Build line from words
              let lineText = '';
              let lineY = null;

              for (const word of paragraph.words) {
                const wordText = word.symbols.map(s => s.text).join('');

                // Get Y coordinate of word (average of vertices)
                const wordY = word.boundingBox?.vertices?.[0]?.y || 0;

                // If this word is on a significantly different Y, it's a new line
                if (lineY !== null && Math.abs(wordY - lineY) > 15) {
                  if (lineText.trim()) {
                    lines.push(lineText.trim());
                  }
                  lineText = wordText;
                  lineY = wordY;
                } else {
                  lineText += (lineText ? ' ' : '') + wordText;
                  if (lineY === null) lineY = wordY;
                }
              }

              if (lineText.trim()) {
                lines.push(lineText.trim());
              }
            }
          }
        }
      }

      console.log('Google Vision extracted lines:', lines);

      return {
        text: fullAnnotation?.text || '',
        lines: lines,
        textAnnotations: textAnnotations // Include raw annotations with bounding boxes
      };
    } catch (error) {
      console.error('Google Vision Error:', error.response?.data || error.message);
      throw new Error('Failed to extract text with Google Vision');
    }
  }

  /**
   * Parse member results using bounding boxes to match names with scores.
   * Names are on the left, scores are on the right at the same Y level.
   */
  static parseMemberResults(ocrData, clanTag) {
    const results = [];

    // Check if we have textAnnotations with bounding boxes
    const textAnnotations = ocrData.textAnnotations || [];

    if (textAnnotations.length > 1) {
      // Use bounding box strategy
      console.log('=== USING BOUNDING BOX STRATEGY ===');
      return this.parseMemberResultsWithBoundingBox(textAnnotations);
    }

    // Fallback to text-based parsing if no annotations
    console.log('=== FALLBACK TO TEXT PARSING (no bounding boxes) ===');
    return this.parseMemberResultsFallback(ocrData);
  }

  /**
   * Parse results using bounding box coordinates.
   * Strategy: Find player names (contain letters), then look for scores to their RIGHT on the same row.
   */
  static parseMemberResultsWithBoundingBox(textAnnotations) {
    const results = [];

    // Skip first element (full text description)
    const annotations = textAnnotations.slice(1);

    console.log(`Processing ${annotations.length} text annotations with bounding boxes`);

    // Group words by their approximate Y coordinate (same row)
    // Each annotation has boundingPoly.vertices with x,y coordinates
    const wordsWithPosition = annotations.map(ann => {
      const vertices = ann.boundingPoly?.vertices || [];

      // Calculate center Y and left X of the bounding box
      const minY = Math.min(...vertices.filter(v => v.y !== undefined).map(v => v.y));
      const maxY = Math.max(...vertices.filter(v => v.y !== undefined).map(v => v.y));
      const minX = Math.min(...vertices.filter(v => v.x !== undefined).map(v => v.x || 0));
      const maxX = Math.max(...vertices.filter(v => v.x !== undefined).map(v => v.x || 0));

      const centerY = (minY + maxY) / 2;

      return {
        text: ann.description,
        centerY,
        minX,
        maxX,
        minY,
        maxY
      };
    });

    // Filter to get potential player names (contain letters, not headers)
    const skipWords = ['clan', 'expedition', 'phases', 'time', 'left', 'currently', 'lunar',
      'mine', 'phase', 'members', 'can', 'challenge', 'bosses', 'and',
      'accumulate', 'member', 'result', 'best', 'recorded', 'current',
      'start', 'turf', 'only', 'the', 'for', 'each', 'is', 'mer', 're'];

    // Find all potential scores (3-4 digit numbers in valid range)
    const scores = wordsWithPosition.filter(w => {
      const isScore = /^\d{3,4}$/.test(w.text);
      const value = parseInt(w.text);
      return isScore && value >= 100 && value <= 2000;
    });

    console.log(`Found ${scores.length} potential scores:`, scores.map(s => ({ text: s.text, y: s.centerY, x: s.minX })));

    // Calculate dynamic Y_TOLERANCE based on average row height
    // This adapts to both large (2000px) and small (600px) images
    const rowHeights = wordsWithPosition.map(w => w.maxY - w.minY).filter(h => h > 0);
    const avgRowHeight = rowHeights.length > 0
      ? rowHeights.reduce((a, b) => a + b, 0) / rowHeights.length
      : 20;

    // Y_TOLERANCE should be roughly the row height (not half, to handle slight misalignments)
    // but we cap it to avoid cross-row matches
    const Y_TOLERANCE = Math.min(avgRowHeight * 1.2, 30);
    console.log(`Dynamic Y_TOLERANCE: ${Y_TOLERANCE.toFixed(1)}px (avg row height: ${avgRowHeight.toFixed(1)}px)`);

    // Find player names: words containing letters that have a score on the same row to the right
    // UTC is no longer required - we identify names by having a valid score on the same row
    const potentialNames = [];

    for (let i = 0; i < wordsWithPosition.length; i++) {
      const word = wordsWithPosition[i];
      const lowerText = word.text.toLowerCase();

      // Skip if it's a header/footer word
      if (skipWords.includes(lowerText)) continue;

      // Skip if it's a number
      if (/^\d+$/.test(word.text)) continue;

      // Skip short words (likely OCR fragments like "In", "Wh", "Ic")
      // Minimum 3 characters to be a valid player name
      if (word.text.length < 3) continue;

      // Skip UTC itself
      if (lowerText === 'utc') continue;

      // Must contain at least one letter (to be a player name)
      if (!/[a-zA-Z]/.test(word.text)) continue;

      // Check if there's a valid score on the same row to the RIGHT
      const hasScoreOnRight = scores.some(score =>
        Math.abs(score.centerY - word.centerY) < Y_TOLERANCE &&
        score.minX > word.maxX // Score must be to the RIGHT of the name
      );

      if (hasScoreOnRight) {
        // Check if UTC is nearby (optional, just for logging)
        const hasUTCNearby = wordsWithPosition.some(other =>
          other.text.toLowerCase() === 'utc' &&
          Math.abs(other.centerY - word.centerY) < 40 &&
          other.minX > word.maxX &&
          other.minX - word.maxX < 200
        );

        potentialNames.push(word);
        console.log(`Found potential name: "${word.text}" at Y=${word.centerY.toFixed(0)}, X=${word.minX}${hasUTCNearby ? ' (has UTC)' : ''}`);
      }
    }

    console.log(`Found ${potentialNames.length} potential player names`);

    // For each potential name, find the score on the same row (to the RIGHT)
    for (const nameWord of potentialNames) {
      // Find scores on the same row that are to the RIGHT of the name
      const matchingScores = scores.filter(score =>
        Math.abs(score.centerY - nameWord.centerY) < Y_TOLERANCE &&
        score.minX > nameWord.maxX // Score must be to the RIGHT of the name
      );

      if (matchingScores.length > 0) {
        // Take the closest score (by X distance)
        const closestScore = matchingScores.reduce((closest, current) => {
          const closestDist = closest.minX - nameWord.maxX;
          const currentDist = current.minX - nameWord.maxX;
          return currentDist < closestDist ? current : closest;
        });

        const playerName = nameWord.text;
        const score = parseInt(closestScore.text);

        console.log(`MATCHED: "${playerName}" (Y=${nameWord.centerY.toFixed(0)}) -> score ${score} (Y=${closestScore.centerY.toFixed(0)})`);

        // Check for duplicates
        const existingIndex = results.findIndex(r =>
          r.playerName.toLowerCase() === playerName.toLowerCase()
        );

        if (existingIndex === -1) {
          results.push({ playerName, score });
        } else if (score > results[existingIndex].score) {
          results[existingIndex].score = score;
        }
      } else {
        console.log(`NO SCORE FOUND for "${nameWord.text}" at Y=${nameWord.centerY.toFixed(0)}`);
      }
    }

    console.log(`\n=== FINAL RESULTS (${results.length} members) ===`);
    results.forEach((r, i) => console.log(`${i + 1}. ${r.playerName}: ${r.score}`));

    return results;
  }

  /**
   * Fallback text-based parsing when bounding boxes aren't available
   */
  static parseMemberResultsFallback(ocrData) {
    const results = [];
    let text = '';

    if (typeof ocrData === 'string') {
      text = ocrData;
    } else {
      text = ocrData.text || '';
    }

    console.log('Parsing member results from text (fallback)');

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    const parsedLines = lines.map((line, index) => {
      const lowerLine = line.toLowerCase();

      if (lowerLine.includes('member') ||
        lowerLine.includes('result') ||
        lowerLine.includes('expedition') ||
        lowerLine.includes('phase') ||
        lowerLine.includes('time left') ||
        lowerLine.includes('currently') ||
        lowerLine.includes('best') ||
        lowerLine.includes('recorded') ||
        lowerLine.includes('start') ||
        lowerLine.includes('lunar') ||
        lowerLine.includes('turf') ||
        lowerLine.includes('mine') ||
        lowerLine.includes('challenge') ||
        lowerLine.includes('bosses')) {
        return { type: 'skip', line, index };
      }

      if (line.match(/^\d{3,4}$/) && Number.parseInt(line) >= 100 && Number.parseInt(line) <= 2000) {
        return { type: 'score', value: Number.parseInt(line), line, index };
      }

      if (line.match(/[a-zA-Z]/) && !line.match(/^\d+$/) && line.length >= 2) {
        let name = line.replace(/\s+[A-Z]{2,4}$/, '').trim();
        name = name.replace(/\bUTC\b/gi, '').trim();
        name = name.replace(/[^\w\.\-_]/g, '').trim();

        if (name.length >= 2 && name.length <= 25) {
          return { type: 'name', value: name, line, index };
        }
      }

      return { type: 'other', line, index };
    });

    const names = parsedLines.filter(p => p.type === 'name');
    const scores = parsedLines.filter(p => p.type === 'score');

    const maxPairs = Math.min(names.length, scores.length);

    for (let i = 0; i < maxPairs; i++) {
      const name = names[i].value;
      const score = scores[i].value;

      const existingIndex = results.findIndex(r =>
        r.playerName.toLowerCase() === name.toLowerCase()
      );

      if (existingIndex === -1) {
        results.push({ playerName: name, score: score });
      } else if (score > results[existingIndex].score) {
        results[existingIndex].score = score;
      }
    }

    return results;
  }

  static extractClanMembers(text) {
    const members = [];
    const lines = text.split('\n').filter(line => line.trim());

    console.log('Extracting members from text:', text);
    console.log('Total lines:', lines.length);

    // Clean up common OCR errors
    const cleanText = text
      .replace(/[^\w\s\.\-·LvATK0-9]/g, ' ')  // Keep only relevant characters
      .replace(/\s+/g, ' ')  // Normalize spaces
      .replace(/Lv\./gi, 'Lv.')  // Normalize Lv.
      .replace(/ATK/gi, 'ATK');  // Normalize ATK

    console.log('Cleaned text:', cleanText);

    // Try to find patterns in the cleaned text
    // Look for: name Lv.XXX ATK XXXXXX patterns
    const patterns = [
      // More flexible patterns for messy OCR
      /([A-Za-z0-9\s\.\-_]{2,20})\s*Lv\.?\s*([0-9]{1,3})\s*ATK\s*([0-9,]{4,10})/gi,
      /([A-Za-z0-9\s\.\-_]{2,20})\s*Lv\.?\s*([0-9]{1,3}).*?([0-9,]{4,10})/gi,
      // Pattern for UTC members
      /([A-Za-z0-9\s\.\-_]{2,20})\s*UTC.*?Lv\.?\s*([0-9]{1,3}).*?ATK\s*([0-9,]{4,10})/gi
    ];

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(cleanText)) !== null) {
        let name = match[1].trim();
        const level = parseInt(match[2]);
        const atk = parseInt(match[3].replace(/,/g, ''));

        // Clean up the name
        name = name.replace(/\s+/g, ' ').trim();

        // Remove common OCR artifacts from names
        name = name.replace(/UTC/g, '').trim();
        name = name.replace(/\s+/g, ' ').trim();

        console.log(`Found member: "${name}", Level: ${level}, ATK: ${atk}`);

        // Better validation
        if (name.length >= 3 && name.length <= 20 &&
          level >= 1 && level <= 200 &&
          atk >= 1000 && atk <= 9999999 &&
          !name.match(/^\d+$/) &&  // Name shouldn't be just numbers
          !name.includes('Member') &&
          !name.includes('Clan')) {

          members.push({
            name: name,
            level: level,
            atk: atk,
            playerId: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
          });
        }
      }

      if (members.length > 0) break;
    }

    // If still no members, try aggressive line-by-line with fuzzy matching
    if (members.length === 0) {
      console.log('Trying aggressive line-by-line parsing...');

      for (const line of lines) {
        const cleanLine = line
          .replace(/[^\w\s\.\-·LvATK0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        console.log('Processing cleaned line:', cleanLine);

        if (cleanLine.includes('Lv') && cleanLine.includes('ATK')) {
          // Extract everything between start and Lv
          const lvIndex = cleanLine.indexOf('Lv');
          const namePart = cleanLine.substring(0, lvIndex).trim();

          // Extract level
          const levelMatch = cleanLine.match(/Lv\.?\s*([0-9]{1,3})/);
          const level = levelMatch ? parseInt(levelMatch[1]) : 0;

          // Extract ATK
          const atkMatch = cleanLine.match(/ATK\s*([0-9,]{4,10})/);
          const atk = atkMatch ? parseInt(atkMatch[1].replace(/,/g, '')) : 0;

          // Clean name
          let name = namePart.replace(/UTC/g, '').trim();
          name = name.replace(/\s+/g, ' ').trim();

          console.log(`Aggressive parsing - Name: "${name}", Level: ${level}, ATK: ${atk}`);

          if (name.length >= 3 && name.length <= 20 &&
            level >= 1 && level <= 200 &&
            atk >= 1000 && atk <= 9999999 &&
            !name.match(/^\d+$/)) {

            members.push({
              name: name,
              level: level,
              atk: atk,
              playerId: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            });
          }
        }
      }
    }

    console.log(`Final result: Extracted ${members.length} members from screenshot`);
    members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.name} - Lv.${member.level} - ATK: ${member.atk}`);
    });

    return members;
  }

  static extractClanId(text) {
    // Look for clan ID patterns in the text
    // Updated patterns based on actual game screenshot format
    const patterns = [
      /Clan\s*ID:\s*([0-9]+)/i,
      /ID:\s*([0-9]+)/i,
      /Tag:\s*([A-Za-z0-9]+)/i,
      /([0-9]{5,8})/ // 5-8 digit numbers (likely clan IDs)
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        console.log(`Found clan ID: ${match[1]} with pattern: ${pattern}`);
        return match[1];
      }
    }

    // Debug: log the extracted text for troubleshooting
    console.log('Extracted text:', text);
    console.log('No clan ID found with current patterns');

    return null;
  }
}

module.exports = OCRService;
