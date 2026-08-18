// ─── Communication Module: Domain & View-Model Types ─────────────────────────

export type BroadcastChannel = 'App Push' | 'SMS' | 'WhatsApp' | 'Email';
export type AnnouncementStatus = 'Published' | 'Scheduled' | 'Draft' | 'Archived';
export type TargetAudience =
  | 'All Students'
  | 'All Parents'
  | 'JEE 2025 & 2026 Batches'
  | 'NEET 2025 Target Batch'
  | 'Students with Dues'
  | 'Faculty & Staff';

export interface AnnouncementItem {
  id:             string;
  title:          string;
  content:        string;
  targetAudience: TargetAudience | string;
  publishDate:    string;
  channels:       BroadcastChannel[];
  readCount:      number;
  totalTarget:    number;
  readRate:       number; // e.g. 74 (%)
  status:         AnnouncementStatus;
  author:         string;
}

export interface ChannelBreakdownItem {
  name:    string;
  value:   number;
  color:   string;
  percent: string;
}

export interface DirectMessageItem {
  id:         string;
  senderName: string;
  senderRole: 'Parent' | 'Student' | 'Faculty';
  snippet:    string;
  timeAgo:    string;
  isRead:     boolean;
}

export interface ScheduledBroadcastItem {
  id:             string;
  title:          string;
  scheduledTime:  string;
  targetAudience: string;
  channels:       BroadcastChannel[];
}

export interface CommunicationAnalytics {
  totalDispatched:       number;
  successfullyDelivered: number;
  deliveryRate:          number; // e.g. 98 (%)
  avgReadRate:           number; // e.g. 84 (%)
  parentEngagementRate:  number; // e.g. 92 (%)

  channelBreakdown:     ChannelBreakdownItem[];
  recentDirectMessages: DirectMessageItem[];
  scheduledBroadcasts:  ScheduledBroadcastItem[];
}

export interface GetAnnouncementsParams {
  target?:  string;
  channel?: string;
  status?:  string;
  search?:  string;
}

export interface CreateAnnouncementInput {
  title:          string;
  content:        string;
  targetAudience: string;
  channels:       BroadcastChannel[];
  scheduleTime?:  string; // if scheduling for future
}

export interface UpdateAnnouncementInput extends Partial<CreateAnnouncementInput> {
  id:      string;
  status?: AnnouncementStatus;
}
