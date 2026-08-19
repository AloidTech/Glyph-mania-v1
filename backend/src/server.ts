import express from 'express';
import cors from 'cors';
import savesRouter from './routes/saves.js';
import settingsRouter from './routes/settings.js';
import leaderboardRouter from './routes/leaderboard.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'Glyph Mania Game Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/saves', savesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Glyph Mania Backend Server listening on http://localhost:${PORT}`);
});
