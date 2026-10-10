'use client';
// ─── AdminCommunication — Notice & Communication Center ─────────────────────
// Unified Institute Announcement & Broadcasting Console
// Apple / iOS Design System: KPI Cards, AppleDropdown Filters, Multi-Channel Toggles,
// Responsive Desktop Table & Mobile Stacked Cards, Delivery Tracking.

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Send,
  Loader2,
  Megaphone,
  Trash2,
  Users,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  X,
  ChevronRight,
  Check,
  Radio,
  Sparkles,
  Inbox,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  Filter,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  useNotices,
  useCreateNotice,
  useNoticeDeliveryReport,
  useBatches,
  useDeleteNotice,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';
import { AppleDropdown, AppleDropdownOption } from '@/components/ui/AppleDropdown';

// ─── Channel & Status Design Configurations ─────────────────────────────────

interface ChannelMeta {
  id: string;
  label: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  border: string;
  iconBg: string;
  iconColor: string;
  activeBg: string;
  ring: string;
  desc: string;
}

const AVAILABLE_CHANNELS: ChannelMeta[] = [
  {
    id: 'IN_APP',
    label: 'In-App Alert',
    icon: Bell,
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    activeBg: 'bg-indigo-50/70',
    ring: 'ring-indigo-500/20',
    desc: 'Instant alert on student & teacher bell icon',
  },
  {
    id: 'WHATSAPP',
    label: 'WhatsApp',
    icon: MessageSquare,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    activeBg: 'bg-emerald-50/70',
    ring: 'ring-emerald-500/20',
    desc: 'Parent WhatsApp notification on registered phone',
  },
  {
    id: 'EMAIL',
    label: 'Email',
    icon: Mail,
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    border: 'border-sky-200',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    activeBg: 'bg-sky-50/70',
    ring: 'ring-sky-500/20',
    desc: 'Official email circular with detailed message',
  },
  {
    id: 'SMS',
    label: 'SMS Text',
    icon: Smartphone,
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    activeBg: 'bg-amber-50/70',
    ring: 'ring-amber-500/20',
    desc: 'Direct SMS message to guardian mobile number',
  },
];

const CHANNEL_MAP = new Map(AVAILABLE_CHANNELS.map((c) => [c.id, c]));

interface DeliveryStatusStyle {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

const STATUS_STYLE: Record<string, DeliveryStatusStyle> = {
  QUEUED: { label: 'Queued', bg: 'bg-slate-100', text: 'text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  SENT: { label: 'Sent', bg: 'bg-emerald-50', text: 'text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  DELIVERED: { label: 'Delivered', bg: 'bg-emerald-50', text: 'text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  READ: { label: 'Read', bg: 'bg-indigo-50', text: 'text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' },
  FAILED: { label: 'Failed', bg: 'bg-rose-50', text: 'text-rose-800 border-rose-200', dot: 'bg-rose-500' },
};

const DEFAULT_STATUS_STYLE: DeliveryStatusStyle = {
  label: 'Pending',
  bg: 'bg-slate-100',
  text: 'text-slate-700 border-slate-200',
  dot: 'bg-slate-400',
};

interface NoticeRow {
  id: string;
  title: string;
  body?: string;
  channels: string[];
  targetAudience?: { roles?: string[]; batchIds?: string[]; studentIds?: string[] };
  createdAt: string;
  _count?: { deliveries: number };
}

// ─── Main Admin Communication Component ─────────────────────────────────────

export function AdminCommunication() {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [audienceFilter, setAudienceFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<NoticeRow | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<NoticeRow | null>(null);

  const deleteNotice = useDeleteNotice();
  const { data, isPending, isError, refetch } = useNotices();
  const { data: batches = [] } = useBatches();

  const notices: NoticeRow[] = useMemo(() => data?.data ?? [], [data]);

  // ── Metrics Calculation ──
  const metrics = useMemo(() => {
    const total = notices.length;
    const totalRecipients = notices.reduce((acc, n) => acc + (n._count?.deliveries || 0), 0);
    const inAppCount = notices.filter((n) => n.channels.includes('IN_APP')).length;
    const multiChannelCount = notices.filter((n) => n.channels.length > 1).length;
    const batchTargeted = notices.filter(
      (n) => n.targetAudience?.batchIds && n.targetAudience.batchIds.length > 0
    ).length;
    return { total, totalRecipients, inAppCount, multiChannelCount, batchTargeted };
  }, [notices]);

  // ── Batch Map for display ──
  const batchMap = useMemo(() => {
    const map = new Map<string, string>();
    (batches || []).forEach((b: any) => map.set(b.id, b.name));
    return map;
  }, [batches]);

  // ── Channel Dropdown Options ──
  const channelOptions: AppleDropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Channels' },
    { value: 'IN_APP', label: 'In-App Alerts', badge: String(metrics.inAppCount) },
    { value: 'WHATSAPP', label: 'WhatsApp' },
    { value: 'EMAIL', label: 'Email' },
    { value: 'SMS', label: 'SMS Text' },
  ], [metrics]);

  // ── Audience Dropdown Options ──
  const audienceOptions: AppleDropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Audiences' },
    { value: 'STUDENTS', label: 'All Students (Institute-Wide)' },
    { value: 'TEACHERS', label: 'Staff & Teachers' },
    ...batches.map((b: any) => ({
      value: `BATCH:${b.id}`,
      label: b.name,
      sublabel: b.classYear ? `${b.classYear}${b.section ? ` · Sec ${b.section}` : ''}` : undefined,
    })),
  ], [batches]);

  // ── Filtered Notices ──
  const visibleNotices = useMemo(() => {
    return notices.filter((n) => {
      // Search
      const q = search.trim().toLowerCase();
      if (q) {
        const titleMatch = n.title.toLowerCase().includes(q);
        const bodyMatch = (n.body || '').toLowerCase().includes(q);
        if (!titleMatch && !bodyMatch) return false;
      }
      // Channel
      if (channelFilter !== 'ALL' && !n.channels.includes(channelFilter)) {
        return false;
      }
      // Audience
      if (audienceFilter !== 'ALL') {
        if (audienceFilter === 'STUDENTS') {
          const roles = n.targetAudience?.roles || [];
          if (!roles.includes('STUDENT') && !n.targetAudience?.studentIds) return false;
        } else if (audienceFilter === 'TEACHERS') {
          const roles = n.targetAudience?.roles || [];
          if (!roles.includes('TEACHER')) return false;
        } else if (audienceFilter.startsWith('BATCH:')) {
          const targetBatchId = audienceFilter.replace('BATCH:', '');
          const bIds = n.targetAudience?.batchIds || [];
          if (!bIds.includes(targetBatchId)) return false;
        }
      }
      return true;
    });
  }, [notices, search, channelFilter, audienceFilter]);

  function getAudienceBadge(n: NoticeRow) {
    if (n.targetAudience?.batchIds && n.targetAudience.batchIds.length > 0) {
      const names = n.targetAudience.batchIds.map((id) => batchMap.get(id) || 'Batch').join(', ');
      return { label: names, type: 'batch' };
    }
    const roles = n.targetAudience?.roles || [];
    if (roles.includes('TEACHER') && roles.includes('STUDENT')) {
      return { label: 'Entire Institute', type: 'institute' };
    }
    if (roles.includes('TEACHER')) {
      return { label: 'Staff & Teachers', type: 'teachers' };
    }
    return { label: 'All Students', type: 'students' };
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1550px] mx-auto w-full animate-fadein">
      {/* ── Top Bar / Header (Apple / iOS Style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[19px] sm:text-[21px] font-bold text-slate-900 tracking-tight">
                  Notice Center
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                  Broadcasts
                </span>
              </div>
              <p className="text-[12px] sm:text-[13px] text-slate-500 mt-0.5">
                Broadcast announcements, circulars & notifications to students, batches, or staff across channels.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[13px] font-bold rounded-xl shadow-sm shadow-indigo-600/20 transition-all cursor-pointer min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          <span>New Notice</span>
        </button>
      </div>

      {/* ── KPI Lifecycle Summary Cards (Apple Style) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <button
          onClick={() => {
            setChannelFilter('ALL');
            setAudienceFilter('ALL');
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            channelFilter === 'ALL' && audienceFilter === 'ALL'
              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Notices</span>
          <span className="text-[19px] sm:text-[22px] font-extrabold text-slate-900 mt-0.5 block">{metrics.total}</span>
        </button>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white text-left">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Recipients Reached</span>
          <span className="text-[19px] sm:text-[22px] font-extrabold text-emerald-800 mt-0.5 block">{metrics.totalRecipients}</span>
        </div>

        <button
          onClick={() => setChannelFilter('IN_APP')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            channelFilter === 'IN_APP'
              ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">In-App Alerts</span>
            <Bell className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <span className="text-[19px] sm:text-[22px] font-extrabold text-indigo-900 mt-0.5 block">{metrics.inAppCount}</span>
        </button>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white text-left">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">Multi-Channel</span>
            <Share2 className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <span className="text-[19px] sm:text-[22px] font-extrabold text-purple-900 mt-0.5 block">{metrics.multiChannelCount}</span>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-white text-left col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Batch Specific</span>
            <Users className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-[19px] sm:text-[22px] font-extrabold text-amber-900 mt-0.5 block">{metrics.batchTargeted}</span>
        </div>
      </div>

      {/* ── Search & Apple Dropdowns Filter Bar ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notices by title or content..."
            className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50/50 min-h-[42px]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 min-w-0 w-full lg:w-auto">
          <div className="min-w-0 w-full sm:w-[180px]">
            <AppleDropdown
              value={channelFilter}
              onChange={(val) => setChannelFilter(val)}
              options={channelOptions}
              placeholder="All Channels"
              size="sm"
            />
          </div>
          <div className="min-w-0 w-full sm:w-[210px]">
            <AppleDropdown
              value={audienceFilter}
              onChange={(val) => setAudienceFilter(val)}
              options={audienceOptions}
              placeholder="All Audiences"
              size="sm"
              searchable
            />
          </div>
          {(channelFilter !== 'ALL' || audienceFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setChannelFilter('ALL');
                setAudienceFilter('ALL');
                setSearch('');
              }}
              className="col-span-2 sm:col-span-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer min-h-[42px] flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ── States: Loading, Error, Empty ── */}
      {isPending && <SkeletonTable rows={6} cols={5} />}

      {isError && (
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-rose-500" />}
          title="Couldn't load notices"
          description="Failed to load communication records. Check connection and retry."
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      )}

      {!isPending && !isError && visibleNotices.length === 0 && (
        <EmptyState
          icon={<Megaphone className="w-8 h-8 text-slate-400" />}
          title={search || channelFilter !== 'ALL' || audienceFilter !== 'ALL' ? 'No matching notices' : 'No notices broadcast yet'}
          description={
            search || channelFilter !== 'ALL' || audienceFilter !== 'ALL'
              ? 'No notices match your current filters. Try resetting search or channel filters.'
              : 'Broadcast announcements, holiday notices, date sheets, or circulars to your students and teachers.'
          }
          action={{ label: 'Broadcast New Notice', onClick: () => setCreateOpen(true) }}
        />
      )}

      {/* ── Content: Desktop Table & Mobile Stacked Cards ── */}
      {!isPending && !isError && visibleNotices.length > 0 && (
        <div>
          {/* Desktop Table (hidden on mobile/tablet) */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75">
                    <th className="px-5 py-3 font-bold text-slate-600 uppercase tracking-wide">Notice Title</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Target Audience</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Channels</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Recipients</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Sent Time</th>
                    <th className="px-5 py-3 font-bold text-slate-600 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleNotices.map((notice) => {
                    const audience = getAudienceBadge(notice);
                    return (
                      <tr key={notice.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Title */}
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-[13.5px] text-slate-900 leading-snug">{notice.title}</div>
                          {notice.body && (
                            <p className="text-[11.5px] text-slate-500 line-clamp-1 mt-0.5 max-w-md">{notice.body}</p>
                          )}
                        </td>

                        {/* Target Audience */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
                            <Users className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[170px]">{audience.label}</span>
                          </span>
                        </td>

                        {/* Channels */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {notice.channels.map((ch) => {
                              const meta = CHANNEL_MAP.get(ch);
                              if (!meta) return null;
                              const Icon = meta.icon;
                              return (
                                <span
                                  key={ch}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${meta.badgeBg} ${meta.badgeText} ${meta.border}`}
                                >
                                  <Icon className="w-3 h-3" />
                                  <span>{meta.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Recipients */}
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11.5px] font-bold border border-emerald-200/80">
                            <Users className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{notice._count?.deliveries ?? '—'} Recipients</span>
                          </div>
                        </td>

                        {/* Sent Date */}
                        <td className="px-4 py-3.5 text-slate-500 text-[11.5px]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(notice.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setReportTarget(notice)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11.5px] font-bold transition-colors cursor-pointer"
                              title="View delivery breakdown"
                            >
                              <BarChart2 className="w-3.5 h-3.5" />
                              <span>Delivery Report</span>
                            </button>
                            <button
                              onClick={() => setWithdrawTarget(notice)}
                              title="Withdraw notice"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Card Layout (hidden on lg screens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3.5">
            {visibleNotices.map((notice) => {
              const audience = getAudienceBadge(notice);
              return (
                <div
                  key={notice.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Title & Audience */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 mb-1">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span className="truncate">{audience.label}</span>
                        </span>
                        <h3 className="font-bold text-[15px] text-slate-900 leading-snug">{notice.title}</h3>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 shrink-0">
                        {notice._count?.deliveries ?? '—'} Rec.
                      </span>
                    </div>

                    {/* Excerpt */}
                    {notice.body && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {notice.body}
                      </p>
                    )}

                    {/* Channels Pill Row */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {notice.channels.map((ch) => {
                        const meta = CHANNEL_MAP.get(ch);
                        if (!meta) return null;
                        const Icon = meta.icon;
                        return (
                          <span
                            key={ch}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${meta.badgeBg} ${meta.badgeText} ${meta.border}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{meta.label}</span>
                          </span>
                        );
                      })}
                    </div>

                    {/* Timestamp */}
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(notice.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setReportTarget(notice)}
                      className="flex-1 py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Delivery Report</span>
                    </button>
                    <button
                      onClick={() => setWithdrawTarget(notice)}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center border border-slate-200"
                      title="Withdraw notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Dialogs & Drawers ── */}
      {createOpen && <CreateNoticeModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />}

      {/* Withdraw Notice Confirmation Modal */}
      {withdrawTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">Withdraw this notice?</h3>
                <p className="text-xs text-slate-500">Notice will be immediately removed from recipient inboxes.</p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
              <p><b>Title:</b> {withdrawTarget.title}</p>
              <p><b>Recipients affected:</b> {withdrawTarget._count?.deliveries ?? 0}</p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={async () => {
                  await deleteNotice.mutateAsync(withdrawTarget.id);
                  setWithdrawTarget(null);
                }}
                disabled={deleteNotice.isPending}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 min-h-[42px] flex items-center justify-center gap-1.5"
              >
                {deleteNotice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Withdraw Notice</span>
              </button>
              <button
                onClick={() => setWithdrawTarget(null)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer min-h-[42px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Report Modal */}
      {reportTarget && <DeliveryReportModal notice={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  );
}

// ─── Apple / iOS Create Notice Modal ────────────────────────────────────────

function CreateNoticeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const { data: batches = [] } = useBatches();
  const createNotice = useCreateNotice();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<string[]>(['IN_APP']);
  const [audienceType, setAudienceType] = useState<'STUDENTS' | 'BATCH' | 'TEACHERS'>(
    isTeacher ? 'BATCH' : 'STUDENTS'
  );
  const [batchId, setBatchId] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'URGENT'>('NORMAL');

  const batchSelectOptions: AppleDropdownOption[] = useMemo(() => {
    return batches.map((b: any) => ({
      value: b.id,
      label: b.name,
      sublabel: b.classYear ? `${b.classYear}${b.section ? ` · Sec ${b.section}` : ''}` : undefined,
    }));
  }, [batches]);

  if (!isOpen) return null;

  function toggleChannel(c: string) {
    setChannels((prev) => {
      if (prev.includes(c)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((x) => x !== c);
      }
      return [...prev, c];
    });
  }

  function reset() {
    setTitle('');
    setBody('');
    setChannels(['IN_APP']);
    setBatchId('');
    setAudienceType(isTeacher ? 'BATCH' : 'STUDENTS');
    setPriority('NORMAL');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || channels.length === 0) return;
    if (audienceType === 'BATCH' && !batchId) return;

    let targetAudience: any;
    if (audienceType === 'BATCH') {
      targetAudience = { batchIds: [batchId] };
    } else if (audienceType === 'TEACHERS') {
      targetAudience = { roles: ['TEACHER'] };
    } else {
      targetAudience = { roles: ['STUDENT'] };
    }

    createNotice.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        channels,
        targetAudience,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-fadein"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-slate-900">Broadcast New Notice</h3>
              <p className="text-xs text-slate-500">Send announcements to students, parents, or staff across channels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Notice Title <span className="text-rose-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali Break Schedule & Holiday Homework Guidelines"
              required
              className="w-full px-3.5 py-2.5 text-xs sm:text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white min-h-[42px]"
            />
          </div>

          {/* Target Audience Selector (iOS Segmented Tabs) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Target Audience <span className="text-rose-500">*</span>
            </label>
            {!isTeacher ? (
              <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl min-h-[42px] border border-slate-200/80 mb-2">
                <button
                  type="button"
                  onClick={() => setAudienceType('STUDENTS')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    audienceType === 'STUDENTS'
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="truncate">All Students</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('BATCH')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    audienceType === 'BATCH'
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="truncate">Specific Batch</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudienceType('TEACHERS')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    audienceType === 'TEACHERS'
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span className="truncate">Staff / Teachers</span>
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mb-1.5">As a teacher, select the assigned batch to notify:</p>
            )}

            {/* If Batch Chosen */}
            {audienceType === 'BATCH' && (
              <div className="mt-1.5 animate-fadein">
                <AppleDropdown
                  value={batchId}
                  onChange={(val) => setBatchId(val)}
                  options={batchSelectOptions}
                  placeholder="Select a class / batch..."
                  size="sm"
                  searchable
                />
              </div>
            )}
          </div>

          {/* Delivery Channels (iOS Interactive Toggle Cards) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Delivery Channels <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">{channels.length} selected</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_CHANNELS.map((ch) => {
                const isSelected = channels.includes(ch.id);
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between ${
                      isSelected
                        ? `${ch.activeBg} ${ch.border} ring-2 ${ch.ring}`
                        : 'bg-white border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl ${ch.iconBg} ${ch.iconColor} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block truncate">{ch.label}</span>
                        <span className="text-[10px] text-slate-500 block truncate">{ch.desc}</span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {channels.some((c) => c !== 'IN_APP') && (
              <div className="mt-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2 text-amber-900 text-[11px]">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <b>In-App Alerts</b> deliver immediately to student & teacher dashboards. External Email / WhatsApp / SMS providers are queued and logged in the delivery report.
                </p>
              </div>
            )}
          </div>

          {/* Message Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Notice Message <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">{body.length} characters</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write the full announcement, guidelines, timing details, or instructions..."
              required
              className="w-full p-3 text-xs sm:text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={createNotice.isPending || !title.trim() || !body.trim() || channels.length === 0 || (audienceType === 'BATCH' && !batchId)}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[42px]"
            >
              {createNotice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Broadcast Notice</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer min-h-[42px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Apple / iOS Delivery Report Modal ──────────────────────────────────────

function DeliveryReportModal({ notice, onClose }: { notice: NoticeRow | null; onClose: () => void }) {
  const { data, isPending } = useNoticeDeliveryReport(notice?.id ?? null);

  if (!notice) return null;

  const deliveries: { id: string; channel: string; status: string; failureReason?: string | null }[] = data?.deliveries ?? [];
  const summary: Record<string, number> = data?.summary ?? {};
  const total = deliveries.length;
  const successful = (summary.DELIVERED || 0) + (summary.SENT || 0) + (summary.READ || 0);
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-fadein"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase tracking-wide">
                Delivery Breakdown
              </span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-slate-500 text-xs font-semibold">{total} Total Dispatches</span>
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mt-0.5 truncate max-w-md">{notice.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {/* KPI Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wide block">Delivered / Sent</span>
              <span className="text-[18px] font-extrabold mt-0.5 block">{successful}</span>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wide block">Read in App</span>
              <span className="text-[18px] font-extrabold mt-0.5 block">{summary.READ || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wide block">Queued</span>
              <span className="text-[18px] font-extrabold mt-0.5 block">{summary.QUEUED || 0}</span>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wide block">Failed</span>
              <span className="text-[18px] font-extrabold mt-0.5 block">{summary.FAILED || 0}</span>
            </div>
          </div>

          {/* Delivery Progress Bar */}
          {total > 0 && (
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Success Rate</span>
                <span>{successRate}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(successful / total) * 100}%` }} />
                <div className="bg-amber-400 h-full transition-all" style={{ width: `${((summary.QUEUED || 0) / total) * 100}%` }} />
                <div className="bg-rose-500 h-full transition-all" style={{ width: `${((summary.FAILED || 0) / total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Recipient Deliveries Log */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2">
              Recipient Delivery Log ({deliveries.length})
            </h4>

            {isPending ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <p className="text-xs">Fetching delivery records...</p>
              </div>
            ) : deliveries.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                No delivery logs available for this notice.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[36vh] overflow-y-auto custom-scrollbar">
                {deliveries.map((d) => {
                  const chMeta = CHANNEL_MAP.get(d.channel);
                  const Icon = chMeta?.icon || Bell;
                  const st = (STATUS_STYLE[d.status] as DeliveryStatusStyle | undefined) ?? DEFAULT_STATUS_STYLE;
                  return (
                    <div key={d.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg ${chMeta?.iconBg || 'bg-slate-100'} ${chMeta?.iconColor || 'text-slate-600'} flex items-center justify-center shrink-0`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 block">{chMeta?.label || d.channel}</span>
                          {d.failureReason && (
                            <span className="text-[10.5px] text-rose-600 font-medium truncate block">
                              Reason: {d.failureReason.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        <span>{st.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
