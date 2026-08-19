import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const dataDir = path.resolve(process.cwd(), 'data');
const leaderboardFilePath = path.join(dataDir, 'leaderboard.json');

const DEFAULT_SCORES = [
  { rank: 1, playerName: 'Archmage Vance', score: 25400, level: 12, difficulty: 'Glyphmaster', date: '2026-08-15' },
  { rank: 2, playerName: 'RuneSeeker', score: 18200, level: 9, difficulty: 'Hard', date: '2026-08-16' },
  { rank: 3, playerName: 'Astral Orb', score: 12500, level: 7, difficulty: 'Normal', date: '2026-08-17' },
];

function getLeaderboardData() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(leaderboardFilePath)) {
    fs.writeFileSync(leaderboardFilePath, JSON.stringify(DEFAULT_SCORES, null, 2));
    return DEFAULT_SCORES;
  }
  try {
    const content = fs.readFileSync(leaderboardFilePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return DEFAULT_SCORES;
  }
}

// GET /api/leaderboard
router.get('/', (_req: Request, res: Response) => {
  const leaderboard = getLeaderboardData();
  res.json({ success: true, leaderboard });
});

// POST /api/leaderboard
router.post('/', (req: Request, res: Response) => {
  const { playerName, score, level, difficulty } = req.body;
  if (!playerName || !score) {
    res.status(400).json({ success: false, error: 'Invalid score entry' });
    return;
  }

  const scores = getLeaderboardData();
  scores.push({
    rank: 0,
    playerName,
    score: Number(score),
    level: Number(level) || 1,
    difficulty: difficulty || 'Normal',
    date: new Date().toISOString().split('T')[0]
  });

  // Sort descending by score & recalculate ranks
  scores.sort((a: any, b: any) => b.score - a.score);
  scores.forEach((entry: any, index: number) => {
    entry.rank = index + 1;
  });

  const topScores = scores.slice(0, 20); // Keep top 20
  fs.writeFileSync(leaderboardFilePath, JSON.stringify(topScores, null, 2));

  res.json({ success: true, leaderboard: topScores });
});

export default router;
