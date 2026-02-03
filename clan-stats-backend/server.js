const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Initialize Firebase (this also initializes the connection)
const { db } = require('./services/firebaseService');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
const fs = require('fs');
const uploadsDir = path.join(process.cwd(), 'uploads');
// Ensure uploads directory exists (important for Cloud Run / container environments)
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory at', uploadsDir);
  } catch (err) {
    console.error('Failed to create uploads directory', err);
  }
}
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // sanitize filename by replacing path separators and trimming
    const safeName = file.originalname.replace(/[/\\]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({ storage: storage });

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Clan Stats API is running with Firestore!' });
});

// Import routes
const authRoutes = require('./routes/auth');
const clanRoutes = require('./routes/clan');
const memberRoutes = require('./routes/members');
const resultRoutes = require('./routes/results');
const membersImportRoutes = require('./routes/members-import');
const communityRoutes = require('./routes/community');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/clan', clanRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/members-import', membersImportRoutes);
app.use('/api/community', communityRoutes);

// Global error handlers to aid debugging in Cloud Run
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

app.listen(PORT, HOST, () => {
  console.log(`Server is running and listening on http://${HOST}:${PORT}`);
  console.log('Connected to Firebase Firestore (if credentials available)');
});
