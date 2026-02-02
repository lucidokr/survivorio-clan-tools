const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Initialize Firebase (this also initializes the connection)
const { db } = require('./services/firebaseService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Connected to Firebase Firestore');
});
