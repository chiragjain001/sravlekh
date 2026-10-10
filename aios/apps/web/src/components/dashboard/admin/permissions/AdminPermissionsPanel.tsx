'use client';

import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  Users,
  Sparkles,
  History,
  Activity,
  Layers,
  Lock,
} from 'lucide-react';
import { RoleTemplatesView } from './RoleTemplatesView';
import { PermissionEditorView } from './PermissionEditorView';
import { ActiveGrantsView } from './ActiveGrantsView';
import { AccessSimulatorView } from './AccessSimulatorView';
import { PermissionAuditTrailView } from './PermissionAuditTrailView';
import { useRolesAndPermissions, usePermissionGrants } from '@/hooks/useApi';

export type PermissionsSubTab = 'roles' | 'editor' | 'grants' | 'simulator' | 'audit';

export function AdminPermissionsPanel() {
  const [activeTab, setActiveTab] = useState<PermissionsSubTab>('roles');
  const { data: rolesData } = useRolesAndPermissions();
  const { data: grants } = usePermissionGrants();

  const totalRoles = rolesData?.templates?.length ?? 9;
  const activeGrantsCount = grants?.length ?? 0;
  const canonicalCount = rolesData?.canonicalPermissions?.length ?? 30;

  const tabs: { id: PermissionsSubTab; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { id: 'roles', label: 'Role Templates', icon: Shield, badge: totalRoles },
    { id: 'editor', label: 'Permission Matrix', icon: KeyRound },
    { id: 'grants', label: 'Active Grants', icon: Users, badge: activeGrantsCount },
    { id: 'simulator', label: 'Access Simulator', icon: Sparkles },
    { id: 'audit', label: 'Security Audit Trail', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* ── KPI Overview Header ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            Roles &amp; Templates
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{totalRoles}</div>
          <p className="text-[10px] text-slate-400">System templates &amp; custom roles</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
            Active Grants
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{activeGrantsCount}</div>
          <p className="text-[10px] text-slate-400">Direct &amp; scoped faculty assignments</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            Protected Operations
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{canonicalCount}</div>
          <p className="text-[10px] text-slate-400">Fine-grained capabilities verified</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            Tenant Security
          </span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600">Isolated</div>
          <p className="text-[10px] text-slate-400">Server-enforced boundaries</p>
        </div>
      </div>

      {/* ── Apple-Inspired Segmented Control Bar ────────────────────────── */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active Sub-View ────────────────────────────────────────────── */}
      <div className="animate-fadein">
        {activeTab === 'roles' && <RoleTemplatesView />}
        {activeTab === 'editor' && <PermissionEditorView />}
        {activeTab === 'grants' && <ActiveGrantsView />}
        {activeTab === 'simulator' && <AccessSimulatorView />}
        {activeTab === 'audit' && <PermissionAuditTrailView />}
      </div>
    </div>
  );
}
