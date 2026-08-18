'use client';
// ─── AdminSystemSettings — Settings & Configurations Console ────────────────
// Service layer backed implementation with TanStack Query hooks and form controls.

import React, { useState, useEffect } from 'react';
import {
  Calendar, Bell, Building, GraduationCap, BellRing, ShieldCheck, Check, Save, Loader2,
} from 'lucide-react';

import { useSystemSettings, useUpdateSettings } from '@/features/settings/hooks/useSettings';
import { InstituteProfileForm }        from '@/features/settings/components/InstituteProfileForm';
import { AcademicRulesForm }           from '@/features/settings/components/AcademicRulesForm';
import { NotificationPreferencesForm } from '@/features/settings/components/NotificationPreferencesForm';
import { SecurityAccessForm }          from '@/features/settings/components/SecurityAccessForm';

import type { SystemSettings, SettingsCategoryTab } from '@/features/settings/types/settings.types';

export function AdminSystemSettings() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryTab>('profile');
  const [formData, setFormData]             = useState<SystemSettings | null>(null);
  const [saved, setSaved]                   = useState(false);

  const { data: serverSettings, isLoading } = useSystemSettings();
  const updateMutation = useUpdateSettings();

  useEffect(() => {
    if (serverSettings && !formData) {
      setFormData(serverSettings);
    }
  }, [serverSettings, formData]);

  if (isLoading || !formData) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto w-full animate-pulse space-y-6">
        <div className="h-10 bg-slate-100 rounded-xl" />
        <div className="h-96 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  async function handleSave() {
    if (!formData) return;
    await updateMutation.mutateAsync(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Institute &amp; Admin Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage institute information, academic rules, notifications, and security</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Today, 23 May 2025</span>
          </div>
          <div className="relative p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              4
            </span>
          </div>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">

        {/* Horizontal Category Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-gray-100 p-2 bg-gray-50/50 overflow-x-auto scrollbar-none">
          {[
            { id: 'profile',       label: 'Institute Profile & Branding', icon: Building },
            { id: 'academic',      label: 'Academic & Attendance Rules', icon: GraduationCap },
            { id: 'notifications', label: 'Notification Preferences',    icon: BellRing },
            { id: 'security',      label: 'Security & Access',           icon: ShieldCheck },
          ].map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as SettingsCategoryTab)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6">

          {/* 1. Category: Institute Profile & Branding */}
          {activeCategory === 'profile' && (
            <InstituteProfileForm
              profile={formData.profile}
              onChange={(profile) => setFormData({ ...formData, profile })}
            />
          )}

          {/* 2. Category: Academic & Attendance Rules */}
          {activeCategory === 'academic' && (
            <AcademicRulesForm
              academic={formData.academic}
              onChange={(academic) => setFormData({ ...formData, academic })}
            />
          )}

          {/* 3. Category: Notification Preferences */}
          {activeCategory === 'notifications' && (
            <NotificationPreferencesForm
              notifications={formData.notifications}
              onChange={(notifications) => setFormData({ ...formData, notifications })}
            />
          )}

          {/* 4. Category: Security & Access */}
          {activeCategory === 'security' && (
            <SecurityAccessForm
              security={formData.security}
              onChange={(security) => setFormData({ ...formData, security })}
            />
          )}

          {/* Bottom Save Action Footer */}
          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Last updated today by Neha Malhotra (Admin)</span>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {updateMutation.isPending
                ? 'Saving…'
                : saved
                ? 'Settings Saved Successfully!'
                : 'Save Settings'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
