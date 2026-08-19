import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const dataDir = path.resolve(process.cwd(), 'data');
const savesFilePath = path.join(dataDir, 'saves.json');

// Helper to ensure data folder and JSON file exist
function getSavesData() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(savesFilePath)) {
    const initial = [
      {
        id: 'save-1',
        slotName: 'Vault of Antiquity',
        timestamp: new Date(Date.now() - 3600000 * 24 * 2).toLocaleString(),
        level: 3,
        score: 4250,
        glyphsCount: 18,
        playTimeSeconds: 840,
        difficulty: 'Normal'
      },
      {
        id: 'save-2',
        slotName: 'Astral Sanctum',
        timestamp: new Date(Date.now() - 3600000 * 5).toLocaleString(),
        level: 7,
        score: 12890,
        glyphsCount: 45,
        playTimeSeconds: 2150,
        difficulty: 'Glyphmaster'
      }
    ];
    fs.writeFileSync(savesFilePath, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const content = fs.readFileSync(savesFilePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeSavesData(saves: any[]) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(savesFilePath, JSON.stringify(saves, null, 2));
}

// GET /api/saves - Fetch all save slots
router.get('/', (_req: Request, res: Response) => {
  const saves = getSavesData();
  res.json({ success: true, saves });
});

// POST /api/saves - Save a new slot or update existing slot
router.post('/', (req: Request, res: Response) => {
  const saveSlot = req.body;
  if (!saveSlot || !saveSlot.slotName) {
    res.status(400).json({ success: false, error: 'Invalid save slot payload' });
    return;
  }

  const saves = getSavesData();
  const index = saves.findIndex((s: any) => s.id === saveSlot.id);

  if (index >= 0) {
    saves[index] = { ...saves[index], ...saveSlot };
  } else {
    const newSave = {
      id: saveSlot.id || `save-${Date.now()}`,
      slotName: saveSlot.slotName,
      timestamp: saveSlot.timestamp || new Date().toLocaleString(),
      level: saveSlot.level || 1,
      score: saveSlot.score || 0,
      glyphsCount: saveSlot.glyphsCount || 0,
      playTimeSeconds: saveSlot.playTimeSeconds || 0,
      difficulty: saveSlot.difficulty || 'Normal'
    };
    saves.unshift(newSave);
  }

  writeSavesData(saves);
  res.json({ success: true, saves });
});

// DELETE /api/saves/:id - Delete a save slot
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  let saves = getSavesData();
  saves = saves.filter((s: any) => s.id !== id);
  writeSavesData(saves);
  res.json({ success: true, saves });
});

export default router;
