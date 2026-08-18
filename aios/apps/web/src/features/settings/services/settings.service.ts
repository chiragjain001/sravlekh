// ─── Settings Service Layer ───────────────────────────────────────────────────

import type { SystemSettings } from '../types/settings.types';
import { MOCK_SYSTEM_SETTINGS } from '../mock/settings.mock';

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let _settingsStore: SystemSettings = JSON.parse(JSON.stringify(MOCK_SYSTEM_SETTINGS));

export async function getSystemSettings(): Promise<SystemSettings> {
  await delay(350);
  return JSON.parse(JSON.stringify(_settingsStore));
}

export async function updateSystemSettings(partial: Partial<SystemSettings>): Promise<SystemSettings> {
  await delay(500);

  _settingsStore = {
    ..._settingsStore,
    ...partial,
    profile:       { ..._settingsStore.profile, ...(partial.profile ?? {}) },
    academic:      { ..._settingsStore.academic, ...(partial.academic ?? {}) },
    notifications: partial.notifications ?? _settingsStore.notifications,
    security:      { ..._settingsStore.security, ...(partial.security ?? {}) },
  };

  return JSON.parse(JSON.stringify(_settingsStore));
}
