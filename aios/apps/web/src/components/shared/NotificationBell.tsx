'use client';
// ─── Real notification bell — every dashboard's bell was previously either
// hardcoded to a fixed number with no click handler, or absent entirely
// (audit-flagged Critical Risk 08). Backed by GET .../notices/mine, reading
// real NoticeDelivery(IN_APP) rows — the same rows the automated weak-topic
// intervention pipeline already writes for teachers, and the same ones any
// admin/teacher broadcast notice creates for its recipients.

import { useRef, useState, useEffect } from 'react';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useMyNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useApi';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data } = useMyNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadein flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-[13px] font-bold text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-[12px]">No notifications yet.</p>
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => !item.readAt && markRead.mutate(item.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 transition-colors ${item.readAt ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}
                >
                  <div className="flex items-start gap-2">
                    {!item.readAt && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-[12.5px] leading-snug ${item.readAt ? 'text-slate-600' : 'font-bold text-slate-800'}`}>{item.notice.title}</p>
                      <p className="text-[11.5px] text-slate-500 mt-0.5 line-clamp-2">{item.notice.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(item.sentAt ?? item.notice.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
