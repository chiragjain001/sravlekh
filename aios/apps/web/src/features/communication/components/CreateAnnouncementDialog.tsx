'use client';
// ─── Create / Edit Announcement Dialog ────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { X, Megaphone, Send, Clock, Loader2 } from 'lucide-react';
import type {
  AnnouncementItem,
  BroadcastChannel,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '../types/communication.types';

const CHANNELS: BroadcastChannel[] = ['App Push', 'SMS', 'WhatsApp', 'Email'];
const TARGET_AUDIENCES = [
  'All Students',
  'All Parents',
  'JEE 2025 & 2026 Batches',
  'NEET 2025 Target Batch',
  'Students with Dues',
  'Faculty & Staff',
];

interface FormState {
  title:          string;
  content:        string;
  targetAudience: string;
  channels:       BroadcastChannel[];
  scheduleTime:   string;
}

const EMPTY_FORM: FormState = {
  title:          '',
  content:        '',
  targetAudience: 'All Students',
  channels:       ['App Push', 'SMS'],
  scheduleTime:   '',
};

interface CreateAnnouncementDialogProps {
  isOpen:     boolean;
  onClose:    () => void;
  editTarget?: AnnouncementItem | null;
  onSubmit:   (data: CreateAnnouncementInput | UpdateAnnouncementInput) => Promise<void>;
}

export function CreateAnnouncementDialog({ isOpen, onClose, editTarget, onSubmit }: CreateAnnouncementDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm]       = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]   = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editTarget) {
      setForm({
        title:          editTarget.title,
        content:        editTarget.content,
        targetAudience: editTarget.targetAudience,
        channels:       editTarget.channels,
        scheduleTime:   '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editTarget, isOpen]);

  function toggleChannel(ch: BroadcastChannel) {
    if (form.channels.includes(ch)) {
      if (form.channels.length === 1) return; // Keep at least one
      setForm({ ...form, channels: form.channels.filter((c) => c !== ch) });
    } else {
      setForm({ ...form, channels: [...form.channels, ch] });
    }
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim())   errs.title   = 'Announcement title is required';
    if (!form.content.trim()) errs.content = 'Message content is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEditMode && editTarget) {
        await onSubmit({
          id:             editTarget.id,
          title:          form.title,
          content:        form.content,
          targetAudience: form.targetAudience,
          channels:       form.channels,
        } as UpdateAnnouncementInput);
      } else {
        await onSubmit({
          title:          form.title,
          content:        form.content,
          targetAudience: form.targetAudience,
          channels:       form.channels,
          scheduleTime:   form.scheduleTime || undefined,
        } as CreateAnnouncementInput);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isEditMode ? 'Edit Broadcast Announcement' : 'New Broadcast Announcement'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{isEditMode ? `Updating ${editTarget!.title}` : 'Dispatch instant notices across App, SMS & WhatsApp'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Announcement Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. JEE Main Mock Test 08 Schedule Released"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
              {errors.title && <p className="text-[10px] text-rose-500 mt-0.5">{errors.title}</p>}
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Target Audience *</label>
              <select
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
              >
                {TARGET_AUDIENCES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1.5">Distribution Channels *</label>
              <div className="flex items-center gap-2 flex-wrap">
                {CHANNELS.map((ch) => {
                  const active = form.channels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`px-3 py-1.5 rounded-lg border font-bold text-xs transition-all cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {active ? '✓ ' : ''}{ch}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Message Content *</label>
              <textarea
                rows={4}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Write clear, concise announcement details to be delivered to parents/students..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
              {errors.content && <p className="text-[10px] text-rose-500 mt-0.5">{errors.content}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Dispatching…' : isEditMode ? 'Save Changes' : 'Dispatch Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
