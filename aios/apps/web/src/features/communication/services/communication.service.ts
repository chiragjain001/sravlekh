// ─── Communication Service Layer ──────────────────────────────────────────────

import type {
  AnnouncementItem,
  CommunicationAnalytics,
  GetAnnouncementsParams,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '../types/communication.types';

import {
  MOCK_ANNOUNCEMENTS,
  MOCK_COMMUNICATION_ANALYTICS,
} from '../mock/communication.mock';

const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

let _announcementsStore: AnnouncementItem[] = JSON.parse(JSON.stringify(MOCK_ANNOUNCEMENTS));
let _analyticsStore: CommunicationAnalytics = JSON.parse(JSON.stringify(MOCK_COMMUNICATION_ANALYTICS));

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getAnnouncementsList(params: GetAnnouncementsParams = {}): Promise<AnnouncementItem[]> {
  await delay(350);

  const { target, channel, status, search } = params;
  let items = [..._announcementsStore];

  if (target) {
    items = items.filter((a) => a.targetAudience.toLowerCase().includes(target.toLowerCase()));
  }
  if (channel) {
    items = items.filter((a) => a.channels.some((c) => c.toLowerCase().includes(channel.toLowerCase())));
  }
  if (status) {
    items = items.filter((a) => a.status.toLowerCase() === status.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (a) => a.title.toLowerCase().includes(q) || a.targetAudience.toLowerCase().includes(q)
    );
  }

  return items;
}

export async function getCommunicationAnalytics(): Promise<CommunicationAnalytics> {
  await delay(400);
  return { ..._analyticsStore };
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<AnnouncementItem> {
  await delay(500);

  const isScheduled = !!input.scheduleTime;

  const newAnn: AnnouncementItem = {
    id:             `ann-${Date.now()}`,
    title:          input.title,
    content:        input.content,
    targetAudience: input.targetAudience,
    publishDate:    input.scheduleTime || 'Just now',
    channels:       input.channels,
    readCount:      0,
    totalTarget:    2480,
    readRate:       0,
    status:         isScheduled ? 'Scheduled' : 'Published',
    author:         'Admin Console',
  };

  _announcementsStore.unshift(newAnn);
  _analyticsStore.totalDispatched += 1;
  return newAnn;
}

export async function updateAnnouncement(input: UpdateAnnouncementInput): Promise<AnnouncementItem> {
  await delay(450);

  const idx = _announcementsStore.findIndex((a) => a.id === input.id);
  if (idx === -1) throw new Error(`Announcement "${input.id}" not found.`);

  const existing = _announcementsStore[idx]!;
  const updated: AnnouncementItem = {
    ...existing,
    title:          input.title          ?? existing.title,
    content:        input.content        ?? existing.content,
    targetAudience: input.targetAudience ?? existing.targetAudience,
    channels:       input.channels       ?? existing.channels,
    status:         input.status         ?? existing.status,
  };

  _announcementsStore[idx] = updated;
  return updated;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await delay(400);
  _announcementsStore = _announcementsStore.filter((a) => a.id !== id);
}

export async function resendAnnouncement(id: string): Promise<void> {
  await delay(500);
  const ann = _announcementsStore.find((a) => a.id === id);
  if (ann) {
    ann.readCount = Math.min(ann.totalTarget, ann.readCount + 50);
    ann.readRate  = Math.round((ann.readCount / ann.totalTarget) * 100);
  }
}
