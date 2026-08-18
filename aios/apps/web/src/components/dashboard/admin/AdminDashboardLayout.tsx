'use client';

import { useAuth } from '@/contexts/auth.context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  HelpCircle,
  MessageSquare,
  ClipboardList,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';

const ADMIN_NAVIGATION = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
  { name: 'Students', href: '/dashboard/admin/students', icon: Users },
  { name: 'Teachers', href: '/dashboard/admin/teachers', icon: GraduationCap },
  { name: 'Batches', href: '/dashboard/admin/batches', icon: BookOpen },
  { name: 'Academics', href: '/dashboard/admin/academics', icon: BookOpen },
  { name: 'Exams', href: '/dashboard/admin/exams', icon: FileText },
  { name: 'Timetable', href: '/dashboard/admin/timetable', icon: CalendarDays },
  { name: 'Attendance', href: '/dashboard/admin/attendance', icon: ClipboardList },
  { name: 'Communication', href: '/dashboard/admin/communication', icon: MessageSquare },
  { name: 'Reports', href: '/dashboard/admin/reports', icon: HelpCircle },
  { name: 'System Settings', href: '/dashboard/admin/settings', icon: Settings },
  { name: 'Audit Logs', href: '/dashboard/admin/logs', icon: Settings },
];

export function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // If user context is loading or unavailable, fallback to a dummy user for layout preview
  const currentUser = user || { name: 'Neha Malhotra', role: 'Institute Admin', initials: 'NM' };
  const initials = currentUser.name.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans">
      {/* ── Mobile Sidebar Overlay ─────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={clsx(
        "w-sidebar bg-[#071327] flex flex-col fixed inset-y-0 z-30 transition-transform duration-300 md:translate-x-0 border-r border-[#1a263d]",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Brand */}
        <div className="h-16 flex items-center px-6 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-white tracking-wide text-lg">AIOS</span>
          </div>
          <button 
            className="md:hidden ml-auto text-gray-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm shadow-inner">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{currentUser.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                  Admin
                </span>
                <p className="text-[11px] text-gray-400 truncate hidden">{currentUser.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {ADMIN_NAVIGATION.map((item) => {
            const isActive = item.href === '/dashboard/admin' 
              ? pathname === '/dashboard/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
              
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-[#1e3a8a] text-white font-medium shadow-sm'
                    : 'text-gray-400 hover:bg-[#0f1f3a] hover:text-gray-200',
                )}
              >
                <item.icon className={clsx("w-4 h-4", isActive ? "text-blue-400" : "text-gray-500")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-4">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-400 hover:bg-[#0f1f3a] hover:text-gray-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 md:ml-sidebar min-w-0 flex flex-col">
        {/* Mobile Header */}
        <div className="md:hidden h-14 bg-white border-b border-border flex items-center px-4">
          <button 
            className="text-gray-500"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
