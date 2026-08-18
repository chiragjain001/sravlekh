'use client';
// ─── Announcement Profile Drawer ─────────────────────────────────────────────
// Slide-over drawer for announcement details, content preview, delivery rates & resend

import React from 'react';
import { X, Megaphone, Users, Clock, Send, Eye, CheckCircle2, RotateCw } from 'lucide-react';
import type { AnnouncementItem } from '../types/communication.types';
import { useResendAnnouncement } from '../hooks/useCommunication';

interface AnnouncementProfileDrawerProps {
  announcement: AnnouncementItem | null;
  onClose:      () => void;
  onEdit?:      (announcement: AnnouncementItem) => void;
}

export function AnnouncementProfileDrawer({ announcement, onClose, onEdit }: AnnouncementProfileDrawerProps) {
  const isOpen = !!announcement;
  const resendMutation = useResendAnnouncement();

  if (!isOpen || !announcement) return null;

  async function handleResend() {
    if (!announcement) return;
    await resendMutation.mutateAsync(announcement.id);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-blue-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 line-clamp-1">{announcement.title}</h3>
              <p className="text-xs text-slate-500">{announcement.publishDate} · {announcement.author}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Metadata Badges */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">TARGET AUDIENCE</span>
              <span className="font-bold text-blue-600 text-xs">{announcement.targetAudience}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">STATUS</span>
              <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-emerald-50 text-emerald-700">
                {announcement.status}
              </span>
            </div>
          </div>

          {/* Active Channels */}
          <div>
            <span className="text-slate-500 font-bold block mb-1.5">Active Channels</span>
            <div className="flex items-center gap-2 flex-wrap">
              {announcement.channels.map((ch, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {ch}
                </span>
              ))}
            </div>
          </div>

          {/* Announcement Text Body */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs">Message Content</h4>
            <p className="text-slate-700 leading-relaxed">{announcement.content}</p>
          </div>

          {/* Delivery & Read Metrics Card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-100 space-y-3">
            <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Delivery &amp; Read Metrics
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-400 font-semibold block">TOTAL TARGET</span>
                <span className="text-sm font-bold text-slate-900">{announcement.totalTarget}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-400 font-semibold block">READ COUNT</span>
                <span className="text-sm font-bold text-emerald-600">{announcement.readCount}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-emerald-100">
                <span className="text-[10px] text-slate-400 font-semibold block">READ RATE</span>
                <span className="text-sm font-bold text-emerald-600">{announcement.readRate}%</span>
              </div>
            </div>

            {/* Read Rate Progress Bar */}
            <div className="w-full bg-emerald-200/50 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${announcement.readRate}%` }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleResend}
            disabled={resendMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 border border-blue-100"
          >
            <RotateCw className="w-3.5 h-3.5" /> Resend Broadcast
          </button>

          <div className="flex gap-2">
            {onEdit && (
              <button onClick={() => { onEdit(announcement); onClose(); }} className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                Edit Notice
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
