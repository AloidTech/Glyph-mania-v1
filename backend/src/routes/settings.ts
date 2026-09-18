import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Settings } from '../types/index.js';

const router = Router();
const dataDir = path.resolve(process.cwd(), 'data');
const settingsFilePath = path.join(dataDir, 'settings.json');

const DEFAULT_SETTINGS: Settings = {
  masterVolume: 80,
  bgmVolume: 70,
  sfxVolume: 85,
  sfxEnabled: true,
  bgmEnabled: true,
  particlesEnabled: true,
  difficulty: 'Normal'
};

function getSettingsData(): Settings {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(settingsFilePath)) {
    fs.writeFileSync(settingsFilePath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return DEFAULT_SETTINGS;
  }
  try {
    const content = fs.readFileSync(settingsFilePath, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) } as Settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettingsData(settings: Settings) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
}

// GET /api/settings - Fetch settings
router.get('/', (_req: Request, res: Response) => {
  const settings = getSettingsData();
  res.json({ success: true, settings });
});

// PUT /api/settings - Update settings
router.put('/', (req: Request, res: Response) => {
  const current = getSettingsData();
  const updated = { ...current, ...req.body };
  writeSettingsData(updated);
  res.json({ success: true, settings: updated });
});

export default router;
