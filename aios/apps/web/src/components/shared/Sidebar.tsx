'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, BookOpen, Calendar, HelpCircle, Trophy, Settings,
  ChevronDown, ChevronUp, Users, FileText, BarChart2, Bell, LogOut,
  GraduationCap, Shield, Crown, Layers, ClipboardList, Clock,
  AlertCircle, DollarSign, Zap, Building, Globe, Activity, Ticket,
  MessageSquare, Clipboard, Star, ChevronLeft, ChevronRight, List,
  Briefcase, Target, Video, Sparkles,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import type { UserRole } from '@/types/db.types';

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  'Today':                 Clock,
  'Overview':              LayoutDashboard,
  'Dashboard':             LayoutDashboard,
  'My Tests':              ClipboardList,
  'Assignments':           BookOpen,
  'Study Plan':            Target,
  'Weak Topics':           AlertCircle,
  'Doubt Center':          HelpCircle,
  'Time Table':            Clock,
  'Extra Classes':         Video,
  'Progress':              BarChart2,
  'Leaderboard':           Trophy,
  'Resources':             Layers,
  'Settings':              Settings,
  'My Classes':            GraduationCap,
  'Paper Builder':         FileText,
  'Question Bank':         Clipboard,
  'Tests & Exams':         ClipboardList,
  'Evaluation Queue':      Star,
  'Analytics':             BarChart2,
  'Remedial & Extra Class':Zap,
  'Reports':               BarChart2,
  'Students':              Users,
  'Teachers':              Briefcase,
  'Batches':               Layers,
  'Academics':             BookOpen,
  'Papers':                FileText,
  'Exams':                 ClipboardList,
  'Doubts':                HelpCircle,
  'Timetable':             Calendar,
  'Attendance':            ClipboardList,
  'Communication':         MessageSquare,
  'System Settings':       Settings,
  'Audit Logs':            List,
  'Evaluation Quality':    Sparkles,
  'Institutes':            Building,
  'Users':                 Users,
  'Subscriptions':         DollarSign,
  'System Health':         Activity,
  'Support Tickets':       Ticket,
  'Feature Management':    Zap,
  'Integrations':          Globe,
};

// ── Role color accents ────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<UserRole, { accent: string; badge: string; badgeBg: string; badgeText: string }> = {
  STUDENT: {
    accent:    'bg-indigo-500',
    badge:     'Student',
    badgeBg:   'bg-indigo-900/60',
    badgeText: 'text-indigo-300',
  },
  TEACHER: {
    accent:    'bg-emerald-500',
    badge:     'Teacher',
    badgeBg:   'bg-emerald-900/60',
    badgeText: 'text-emerald-300',
  },
  ACADEMIC_HEAD: {
    accent:    'bg-teal-500',
    badge:     'Academic Head',
    badgeBg:   'bg-teal-900/60',
    badgeText: 'text-teal-300',
  },
  COORDINATOR: {
    accent:    'bg-cyan-500',
    badge:     'Coordinator',
    badgeBg:   'bg-cyan-900/60',
    badgeText: 'text-cyan-300',
  },
  ADMIN: {
    accent:    'bg-sky-500',
    badge:     'Admin',
    badgeBg:   'bg-sky-900/60',
    badgeText: 'text-sky-300',
  },
  RECEPTIONIST: {
    accent:    'bg-amber-500',
    badge:     'Receptionist',
    badgeBg:   'bg-amber-900/60',
    badgeText: 'text-amber-300',
  },
  ACCOUNTANT: {
    accent:    'bg-orange-500',
    badge:     'Accountant',
    badgeBg:   'bg-orange-900/60',
    badgeText: 'text-orange-300',
  },
  PARENT: {
    accent:    'bg-pink-500',
    badge:     'Parent',
    badgeBg:   'bg-pink-900/60',
    badgeText: 'text-pink-300',
  },
  FOUNDER: {
    accent:    'bg-violet-500',
    badge:     'Super Admin',
    badgeBg:   'bg-violet-900/60',
    badgeText: 'text-violet-300',
  },
};


interface SidebarProps {
  role: UserRole;
  userName: string;
  designation: string;
  avatarInitials: string;
  navItems: string[];
  activeNav: string;
  onNavChange: (item: string) => void;
  onLogout?: () => void;
}

export function Sidebar({
  role,
  userName,
  designation,
  avatarInitials,
  navItems,
  activeNav,
  onNavChange,
  onLogout,
}: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useDashboardStore();
  const cfg = ROLE_CONFIG[role];

  return (
    <div
      className={`flex flex-col h-full bg-sidebar transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-[248px]'
      }`}
      style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.18)' }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${cfg.accent} flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-white font-bold text-[15px] tracking-tight">AIOS</span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className={`w-8 h-8 rounded-lg ${cfg.accent} flex items-center justify-center mx-auto`}>
            <span className="text-white font-bold text-sm">A</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-white transition-colors p-1 rounded ml-auto"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-4 h-4" />
            : <ChevronLeft  className="w-4 h-4" />
          }
        </button>
      </div>

      {/* ── User Profile ── */}
      <div className={`px-3 py-4 border-b border-sidebar-border ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          {/* Avatar */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${cfg.accent} flex items-center justify-center`}>
            <span className="text-white font-semibold text-sm">{avatarInitials}</span>
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-white font-semibold text-[13px] truncate">{userName}</p>
              <p className="text-slate-400 text-[11px] truncate">{designation}</p>
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}>
                {cfg.badge}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item] ?? LayoutDashboard;
          const isActive = activeNav === item;
          return (
            <button
              key={item}
              onClick={() => onNavChange(item)}
              title={sidebarCollapsed ? item : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 mx-0 rounded-none text-[13px] font-medium transition-all duration-150 cursor-pointer
                ${isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }
                ${sidebarCollapsed ? 'justify-center px-0' : 'pl-4'}
              `}
            >
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-indigo-400' : ''}`} />
              {!sidebarCollapsed && <span className="truncate">{item}</span>}
              {!sidebarCollapsed && item === 'Evaluation Queue' && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  3
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Logout ── */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 rounded-lg transition-colors text-[13px] ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}
