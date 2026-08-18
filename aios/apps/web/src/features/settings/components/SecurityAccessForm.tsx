'use client';
// ─── Security & Access Form Component ───────────────────────────────────────

import React from 'react';
import type { SecuritySettings } from '../types/settings.types';

interface SecurityAccessFormProps {
  security: SecuritySettings;
  onChange: (updated: SecuritySettings) => void;
}

export function SecurityAccessForm({ security, onChange }: SecurityAccessFormProps) {
  function handleChange<K extends keyof SecuritySettings>(field: K, value: SecuritySettings[K]) {
    onChange({ ...security, [field]: value });
  }

  return (
    <div className="space-y-6 animate-fadein max-w-4xl">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Admin Account &amp; Security Controls</h3>
        <p className="text-xs text-gray-400 mt-0.5">Update password and manage session timeout limits</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Admin Email Address</label>
            <input
              type="email"
              value={security.adminEmail}
              disabled
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-500 bg-gray-50 font-medium"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Auto-Logout Session Timeout</label>
            <select
              value={security.sessionTimeoutMinutes}
              onChange={(e) => handleChange('sessionTimeoutMinutes', Number(e.target.value))}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={30}>30 Minutes (Recommended)</option>
              <option value={60}>1 Hour</option>
              <option value={120}>2 Hours</option>
            </select>
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Change Password</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Confirm New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
