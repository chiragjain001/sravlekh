// ─── UI Store ─────────────────────────────────────────────────────────────────
// Global UI state: sidebar, theme, toasts, offline status.
import { create } from 'zustand';

interface UIStore {
  sidebarCollapsed: boolean;
  toggleSidebar:    () => void;
  setSidebarCollapsed: (v: boolean) => void;
  isOnline:         boolean;
  setIsOnline:      (v: boolean) => void;
  offlineQueueCount: number;
  setOfflineQueueCount: (n: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed:  false,
  toggleSidebar:     () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  isOnline:          true,
  setIsOnline:       (v) => set({ isOnline: v }),
  offlineQueueCount: 0,
  setOfflineQueueCount: (n) => set({ offlineQueueCount: n }),
}));

// ─── Notification Store ───────────────────────────────────────────────────────
import type { Notification } from '@/types/domain/shared.types';

interface NotificationStore {
  notifications:  Notification[];
  unreadCount:    number;
  isPanelOpen:    boolean;
  addNotification:     (n: Notification) => void;
  markRead:            (id: string) => void;
  markAllRead:         () => void;
  clearAll:            () => void;
  togglePanel:         () => void;
  setNotifications:    (ns: Notification[]) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount:   0,
  isPanelOpen:   false,

  addNotification: (n) => set((s) => ({
    notifications: [n, ...s.notifications],
    unreadCount: s.unreadCount + (n.isRead ? 0 : 1),
  })),

  markRead: (id) => set((s) => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
    unreadCount: Math.max(0, s.unreadCount - 1),
  })),

  markAllRead: () => set((s) => ({
    notifications: s.notifications.map(n => ({ ...n, isRead: true })),
    unreadCount: 0,
  })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  setNotifications: (ns) => set({
    notifications: ns,
    unreadCount: ns.filter(n => !n.isRead).length,
  }),
}));

// ─── Draft Store ──────────────────────────────────────────────────────────────
// Wizard draft management. Scoped by userId + instituteId + branchId + sessionId + wizardType.
// Phase 2: sync to backend DB for multi-device continuity.

const DRAFT_PREFIX = 'aios_draft_';

interface DraftStore {
  saveDraft:   (key: string, data: unknown) => void;
  loadDraft:   <T>(key: string) => T | null;
  deleteDraft: (key: string) => void;
  hasDraft:    (key: string) => boolean;
  getDraftAge: (key: string) => number | null;  // minutes since saved
}

export const useDraftStore = create<DraftStore>(() => ({
  saveDraft: (key, data) => {
    try {
      localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify({ data, savedAt: Date.now() }));
    } catch { /* storage full */ }
  },

  loadDraft: <T>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
      if (!raw) return null;
      return JSON.parse(raw).data as T;
    } catch { return null; }
  },

  deleteDraft: (key) => {
    localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  },

  hasDraft: (key) => {
    return localStorage.getItem(`${DRAFT_PREFIX}${key}`) !== null;
  },

  getDraftAge: (key) => {
    try {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
      if (!raw) return null;
      const { savedAt } = JSON.parse(raw);
      return Math.round((Date.now() - savedAt) / 60000);
    } catch { return null; }
  },
}));

// ─── Filter Store ─────────────────────────────────────────────────────────────
// Persistent filter state per entity type. Survives page refresh.

interface FilterState {
  status?:     string;
  search?:     string;
  sortBy?:     string;
  sortDir?:    'asc' | 'desc';
  page?:       number;
  pageSize?:   number;
  [key: string]: unknown;
}

interface FilterStore {
  filters: Record<string, FilterState>;
  setFilter:      (entity: string, filter: FilterState) => void;
  resetFilter:    (entity: string) => void;
  clearAllFilters: () => void;
  getFilter:      (entity: string) => FilterState;
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  filters: {},
  setFilter:   (entity, filter) => set((s) => ({ filters: { ...s.filters, [entity]: { ...s.filters[entity], ...filter } } })),
  resetFilter: (entity) => set((s) => { const f = { ...s.filters }; delete f[entity]; return { filters: f }; }),
  clearAllFilters: () => set({ filters: {} }),
  getFilter:   (entity) => get().filters[entity] ?? {},
}));
