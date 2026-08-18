'use client';
// ─── Notification Preferences Form Component ─────────────────────────────────

import React from 'react';
import type { NotificationRule } from '../types/settings.types';

interface NotificationPreferencesFormProps {
  notifications: NotificationRule[];
  onChange:      (updated: NotificationRule[]) => void;
}

export function NotificationPreferencesForm({ notifications, onChange }: NotificationPreferencesFormProps) {
  function handleToggle(id: string) {
    const updated = notifications.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n));
    onChange(updated);
  }

  return (
    <div className="space-y-6 animate-fadein max-w-4xl">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Notification Channels &amp; Broadcasts</h3>
        <p className="text-xs text-gray-400 mt-0.5">Control which automated notifications get dispatched to parents and students</p>
      </div>

      <div className="space-y-3">
        {notifications.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100 shrink-0">
                {item.channel}
              </span>
              <div>
                <p className="text-xs font-bold text-gray-900">{item.title}</p>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={() => handleToggle(item.id)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
