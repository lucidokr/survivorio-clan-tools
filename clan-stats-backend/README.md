# Clan Stats Backend

Backend API for the Clan Statistics tracking application.

## Features

- Clan registration with OCR verification
- Member management
- Result tracking via OCR and manual entry
- Weekly statistics and leaderboards
- Performance improvement tracking

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration

4. Create uploads directory:
```bash
mkdir uploads
```

5. Start the server:
```bash
npm run dev
```

## API Endpoints

### Clan Management
- `POST /api/clan/register` - Register new clan with screenshot
- `GET /api/clan` - Get all clans
- `GET /api/clan/:id` - Get clan by ID

### Member Management
- `POST /api/members` - Create new member
- `GET /api/members/clan/:clanId` - Get all members of a clan
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member
- `GET /api/members/:id` - Get member by ID

### Results
- `POST /api/results/upload` - Upload results via screenshot
- `POST /api/results/manual` - Manual result entry
- `GET /api/results/clan/:clanId/week/:week` - Get weekly results
- `GET /api/results/clan/:clanId/top/:week/:limit` - Get top members
- `GET /api/results/member/:memberId/performance` - Get member performance
- `GET /api/results/clan/:clanId/improvement/:weeks` - Get most improved members

## Database Schema

### Clan
- name: String (required)
- clanId: String (required, unique)
- tag: String (required)
- description: String
- screenshot: String (path to verification screenshot)

### Member
- playerName: String (required)
- playerId: String (required, unique)
- phoneNumber: String
- discordNickname: String
- clan: ObjectId (ref: Clan)
- joinDate: Date
- isActive: Boolean

### Result
- member: ObjectId (ref: Member)
- clan: ObjectId (ref: Clan)
- score: Number (required)
- week: String (format: YYYY-WW)
- screenshot: String (path to result screenshot)
- isManualEntry: Boolean
- createdAt: Date

## OCR Processing

The application uses Tesseract.js to extract text from screenshots:
- Extracts player names and scores
- Removes clan tags from player names
- Validates extracted data before saving

## Free Hosting Options

### Database
- MongoDB Atlas (Free tier)
- Firebase (Free tier)
- Supabase (Free tier)

### Backend Hosting
- Vercel (Serverless functions)
- Netlify (Serverless functions)
- Heroku (Free tier)
- Railway (Free tier)

### Frontend Hosting
- Vercel
- Netlify
- GitHub Pages
- Firebase Hosting

### Free Domains
- Freenom (.tk, .ml, .ga, .cf)
- EU.org
- No-IP (dynamic DNS)
