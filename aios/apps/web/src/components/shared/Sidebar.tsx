'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, BookOpen, Calendar, HelpCircle, Trophy, Settings,
  ChevronDown, ChevronUp, Users, FileText, BarChart2, Bell, LogOut,
  GraduationCap, Shield, Crown, Layers, ClipboardList, Clock,
  AlertCircle, DollarSign, Zap, Building, Globe, Activity, Ticket,
  MessageSquare, Clipboard, Star, ChevronLeft, ChevronRight, List,
  Briefcase, Target, Video, Sparkles, PieChart, X,
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
  'Papers':                FileText,
  'Exams':                 ClipboardList,
  'Doubts':                HelpCircle,
  'Timetable':             Calendar,
  'Attendance':            ClipboardList,
  'Communication':         MessageSquare,
  'System Settings':       Settings,
  'Audit Logs':            List,
  'Evaluation Quality':    Sparkles,
  'Analytics & Reports':   PieChart,
  'Student 360':           Users,
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
  ADMIN: {
    accent:    'bg-sky-500',
    badge:     'Admin',
    badgeBg:   'bg-sky-900/60',
    badgeText: 'text-sky-300',
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
  /** Real pending-evaluation count for the "Evaluation Queue" nav badge — omit or 0 to hide it. Previously hardcoded to 3 for every role. */
  evaluationQueueCount?: number;
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
  evaluationQueueCount = 0,
}: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, closeMobileSidebar } = useDashboardStore();
  const cfg = ROLE_CONFIG[role];

  // Close mobile drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileSidebarOpen) {
        closeMobileSidebar();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen, closeMobileSidebar]);

  // Prevent body scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  return (
    <>
      {/* ── Desktop Sidebar (hidden on mobile and tablet, visible from lg up) ── */}
      <aside
        className={`hidden lg:flex flex-col h-full bg-sidebar transition-all duration-300 flex-shrink-0 ${
          sidebarCollapsed ? 'w-16' : 'w-[248px]'
        }`}
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.18)' }}
        aria-label="Desktop sidebar"
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
            className="text-slate-500 hover:text-white transition-colors p-1 rounded ml-auto cursor-pointer"
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
        <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar">
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
                {!sidebarCollapsed && item === 'Evaluation Queue' && evaluationQueueCount > 0 && (
                  <span className="ml-auto bg-rose-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold">
                    {evaluationQueueCount > 99 ? '99+' : evaluationQueueCount}
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
            className={`w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-rose-400 hover:bg-rose-900/20 rounded-lg transition-colors text-[13px] cursor-pointer ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Apple-Style Mobile & Tablet Drawer (visible on < lg when open) ── */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          mobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileSidebarOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
      >
        {/* Apple-style Backdrop Blur Overlay */}
        <div
          onClick={closeMobileSidebar}
          className={`fixed inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300 ${
            mobileSidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />

        {/* Slide-over Sheet Panel */}
        <div
          className={`fixed top-0 bottom-0 left-0 w-[285px] max-w-[85vw] bg-sidebar text-white shadow-2xl flex flex-col z-10 transform transition-transform duration-300 ease-out border-r border-sidebar-border ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Top Header with Logo and Close Button */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border bg-slate-900/40">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl ${cfg.accent} flex items-center justify-center shadow-sm`}>
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <span className="text-white font-bold text-[15px] tracking-tight">AIOS</span>
                <span className="block text-[10.5px] font-semibold text-slate-400">Academic Operating System</span>
              </div>
            </div>
            <button
              onClick={closeMobileSidebar}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="px-4 py-3.5 border-b border-sidebar-border bg-slate-900/25">
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full ${cfg.accent} flex items-center justify-center font-bold text-white text-sm shadow-sm`}>
                {avatarInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-[13.5px] truncate">{userName}</p>
                <p className="text-slate-400 text-[11px] truncate">{designation}</p>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}>
                  {cfg.badge}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Items (44px touch targets for mobile) */}
          <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1 custom-scrollbar">
            {navItems.map((item) => {
              const Icon = ICON_MAP[item] ?? LayoutDashboard;
              const isActive = activeNav === item;
              return (
                <button
                  key={item}
                  onClick={() => {
                    onNavChange(item);
                    closeMobileSidebar();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate flex-1 text-left">{item}</span>
                  {item === 'Evaluation Queue' && evaluationQueueCount > 0 && (
                    <span className="ml-auto bg-rose-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1.5 flex items-center justify-center font-bold">
                      {evaluationQueueCount > 99 ? '99+' : evaluationQueueCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Sign Out */}
          <div className="border-t border-sidebar-border p-3 bg-slate-950/40">
            <button
              onClick={() => {
                closeMobileSidebar();
                onLogout?.();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors text-[13.5px] font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
