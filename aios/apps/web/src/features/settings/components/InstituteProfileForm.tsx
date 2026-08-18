'use client';
// ─── Institute Profile Form Component ────────────────────────────────────────

import React from 'react';
import type { InstituteProfile } from '../types/settings.types';

interface InstituteProfileFormProps {
  profile:  InstituteProfile;
  onChange: (updated: InstituteProfile) => void;
}

export function InstituteProfileForm({ profile, onChange }: InstituteProfileFormProps) {
  function handleChange(field: keyof InstituteProfile, value: string) {
    onChange({ ...profile, [field]: value });
  }

  return (
    <div className="space-y-6 animate-fadein max-w-4xl">
      <div>
        <h3 className="text-sm font-bold text-gray-900">General Institute Information</h3>
        <p className="text-xs text-gray-400 mt-0.5">Basic details displayed on reports, student ID cards, and official receipts</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-gray-700">Institute Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Institute Code</label>
            <input
              type="text"
              value={profile.code}
              onChange={(e) => handleChange('code', e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white font-mono"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">Campus Address</label>
          <input
            type="text"
            value={profile.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Contact Phone Number</label>
            <input
              type="text"
              value={profile.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Official Support Email</label>
            <input
              type="email"
              value={profile.supportEmail}
              onChange={(e) => handleChange('supportEmail', e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Institute Logo</h3>
        <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="p-3 bg-slate-900 rounded-xl text-xl font-black text-blue-500 italic shrink-0">
            AIOS
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-900">Upload Institute Logo</p>
            <p className="text-[10px] text-gray-400">Used on report cards, fee receipts, and parent messages (PNG/JPG up to 2MB)</p>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" className="px-3 py-1 text-xs font-semibold text-blue-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-2xs cursor-pointer">
                Change Logo
              </button>
              <button type="button" className="px-3 py-1 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 cursor-pointer">
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
