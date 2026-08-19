import { SettingsState } from './store';

const API_BASE = '/api';

export async function fetchSettingsApi(): Promise<SettingsState | null> {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.settings : null;
  } catch {
    return null;
  }
}

export async function updateSettingsApi(partial: Partial<SettingsState>): Promise<SettingsState | null> {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.settings : null;
  } catch {
    return null;
  }
}

