export * from './glyph_types.js';

export interface SaveSlot {
  id: string;
  userId?: string; // Links save to a specific profile
  slotName: string;
  timestamp: string;
  level: number;
  score: number;
  glyphsCount: number;
  playTimeSeconds: number;
  difficulty: string;
}

export interface Settings {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  sfxEnabled: boolean;
  bgmEnabled: boolean;
  particlesEnabled: boolean;
  difficulty: string;
}

export interface Profile {
  id: string;           // UUID (likely matching Supabase Auth user ID)
  username: string;
  email?: string;       // Optional if you don't need to expose it publicly
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}
