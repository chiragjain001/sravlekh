'use client';
// ─── Academic Rules Form Component ───────────────────────────────────────────

import React from 'react';
import type { AcademicRules } from '../types/settings.types';

interface AcademicRulesFormProps {
  academic: AcademicRules;
  onChange: (updated: AcademicRules) => void;
}

export function AcademicRulesForm({ academic, onChange }: AcademicRulesFormProps) {
  function handleChange<K extends keyof AcademicRules>(field: K, value: AcademicRules[K]) {
    onChange({ ...academic, [field]: value });
  }

  return (
    <div className="space-y-6 animate-fadein max-w-4xl">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Academic Session &amp; Criteria</h3>
        <p className="text-xs text-gray-400 mt-0.5">Set active session, minimum attendance thresholds, and automated parent alerts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">Active Academic Year</label>
          <select
            value={academic.activeYear}
            onChange={(e) => handleChange('activeYear', e.target.value)}
            className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 bg-white focus:outline-none focus:border-blue-500 font-bold cursor-pointer"
          >
            <option value="2024 - 2025 (Current Active)">2024 - 2025 (Current Active)</option>
            <option value="2025 - 2026 (Upcoming)">2025 - 2026 (Upcoming)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">Minimum Required Attendance (%)</label>
          <input
            type="number"
            value={academic.minAttendance}
            onChange={(e) => handleChange('minAttendance', Number(e.target.value))}
            className="w-full text-xs p-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500 bg-white font-bold"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Automated Class Rules</h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-xs font-bold text-gray-900">Send Instant SMS to Parents on Student Absence</p>
              <p className="text-[10px] text-gray-500">Trigger automated notification as soon as teacher marks absent in class</p>
            </div>
            <input
              type="checkbox"
              checked={academic.sendSMSOnAbsence}
              onChange={(e) => handleChange('sendSMSOnAbsence', e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-xs font-bold text-gray-900">Enable Default Negative Marking on Tests (-1/4)</p>
              <p className="text-[10px] text-gray-500">Apply standard JEE/NEET competitive exam marking scheme on tests</p>
            </div>
            <input
              type="checkbox"
              checked={academic.negativeMarkingOnTests}
              onChange={(e) => handleChange('negativeMarkingOnTests', e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-xs font-bold text-gray-900">Allow Student Self-Attendance via Portal</p>
              <p className="text-[10px] text-gray-500">Allow students to mark digital attendance via kiosk or app in campus</p>
            </div>
            <input
              type="checkbox"
              checked={academic.allowStudentSelfAttendance}
              onChange={(e) => handleChange('allowStudentSelfAttendance', e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
