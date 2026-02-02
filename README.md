# Clan Statistics Tracker

A web application for tracking clan statistics using OCR to extract game results from screenshots.

## Features

- **Clan Registration**: Register your clan
- **Member Management**: Bulk add and manage clan members (40 slots) with contact information
- **Result Upload**: Upload game results via screenshots (OCR) or manual entry
- **Statistics Dashboard**: View weekly leaderboards and performance trends
- **Improvement Tracking**: Compare member performance over time
- **Free Hosting**: Designed to work with free hosting solutions

## Tech Stack

### Frontend

- React 18
- Material-UI (MUI)
- React Router
- Recharts (for statistics visualization)
- Axios (for API calls)

### Backend

- Node.js with Express
- MongoDB with Mongoose
- Tesseract.js (for OCR)
- Multer (for file uploads)
- JWT (for future authentication)

## Project Structure

```
clan-tools/
├── clan-stats-backend/          # Node.js backend API
│   ├── models/                  # MongoDB models
│   │   ├── Clan.js
│   │   ├── Member.js
│   │   └── Result.js
│   ├── routes/                  # API routes
│   │   ├── clan.js
│   │   ├── members.js
│   │   └── results.js
│   ├── services/                # Business logic
│   │   └── ocrService.js
│   ├── uploads/                 # Uploaded screenshots
│   ├── server.js               # Main server file
│   └── package.json
├── clan-stats-frontend/         # React frontend
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   │   └── Navbar.js
│   │   ├── pages/              # Page components
│   │   │   ├── Dashboard.js
│   │   │   ├── ClanRegistration.js
│   │   │   ├── MemberManagement.js
│   │   │   ├── ResultUpload.js
│   │   │   └── Statistics.js
│   │   └── App.js              # Main app component
│   └── package.json
└── README.md
```

## Quick Start

### Option 1: Using Root Package.json Scripts

1. From the root directory, install all dependencies:

```bash
npm run install:all
```

2. Start both backend and frontend:

```bash
npm run start:both
```

Or for development with auto-install:

```bash
npm run dev
```

### Option 2: Manual Setup

#### Backend Setup

1. Navigate to the backend directory:

```bash
cd clan-stats-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Update `.env` with your configuration:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/clan-stats
JWT_SECRET=your-super-secret-jwt-key-here
FRONTEND_URL=http://localhost:3000
```

5. Create uploads directory:

```bash
mkdir uploads
```

6. Start the backend server:

```bash
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd clan-stats-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the frontend development server:

```bash
npm start
```

## Usage

1. **Register Your Clan**:
    - Go to the "Register Clan" page
    - Enter clan details and upload a verification screenshot
    - The OCR system will extract and verify your clan ID

2. **Manage Members**:
    - Navigate to "Members" page
    - Add clan members with their details (player ID, phone, Discord)

3. **Upload Results**:
    - Use "Upload Results" page
    - Either upload a screenshot (OCR will extract names and scores)
    - Or manually enter results for individual members

4. **View Statistics**:
    - Check the "Statistics" page for leaderboards
    - View performance trends and improvement tracking

## Free Hosting Options

### Database

- **MongoDB Atlas**: Free tier with 512MB storage
- **Firebase**: Free tier with generous limits
- **Supabase**: Free PostgreSQL database

### Backend Hosting

- **Vercel**: Serverless functions (free for personal use)
- **Netlify**: Serverless functions
- **Heroku**: Free tier (with limitations)
- **Railway**: Free tier with $5 credit monthly

### Frontend Hosting

- **Vercel**: Free hosting for React apps
- **Netlify**: Free hosting with CI/CD
- **GitHub Pages**: Free static hosting
- **Firebase Hosting**: Free tier

### Free Domains

- **Freenom**: Free domains (.tk, .ml, .ga, .cf)
- **EU.org**: Free domains
- **No-IP**: Free dynamic DNS

## OCR Configuration

The OCR system is configured to:

- Extract player names and scores from screenshots
- Remove clan tags from player names
- Validate extracted data (scores between 1-9999)
- Support English and Japanese characters

## API Endpoints

### Clan Management

- `POST /api/clan/register` - Register new clan
- `GET /api/clan` - Get all clans
- `GET /api/clan/:id` - Get clan by ID

### Member Management

- `POST /api/members` - Create member
- `GET /api/members/clan/:clanId` - Get clan members
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member

### Results

- `POST /api/results/upload` - Upload screenshot results
- `POST /api/results/manual` - Manual result entry
- `GET /api/results/clan/:clanId/week/:week` - Get weekly results
- `GET /api/results/clan/:clanId/top/:week/:limit` - Get top members
- `GET /api/results/member/:memberId/performance` - Member performance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
