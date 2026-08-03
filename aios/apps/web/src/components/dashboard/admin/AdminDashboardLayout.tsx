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
  { name: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
  { name: 'Students', href: '/dashboard/admin/students', icon: GraduationCap },
  { name: 'Teachers', href: '/dashboard/admin/teachers', icon: Users },
  { name: 'Batches', href: '/dashboard/admin/batches', icon: BookOpen },
  { name: 'Timetable', href: '/dashboard/admin/timetable', icon: CalendarDays },
  { name: 'Question Bank', href: '/dashboard/admin/questions', icon: HelpCircle },
  { name: 'Papers', href: '/dashboard/admin/papers', icon: FileText },
  { name: 'Exams', href: '/dashboard/admin/exams', icon: BookOpen },
  { name: 'Assignments', href: '/dashboard/admin/assignments', icon: ClipboardList },
  { name: 'Doubts', href: '/dashboard/admin/doubts', icon: MessageSquare },
  { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
];

export function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return null; // Or a loading spinner

  return (
    <div className="min-h-screen bg-bg flex">
      {/* ── Mobile Sidebar Overlay ─────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-navy-900/50 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={clsx(
        "w-sidebar bg-white border-r border-border flex flex-col fixed inset-y-0 z-30 transition-transform duration-300 md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-navy-900 tracking-tight">AIOS</span>
          </div>
          <button 
            className="md:hidden text-navy-500 hover:text-navy-900"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {ADMIN_NAVIGATION.map((item) => {
            const isActive = item.href === '/dashboard/admin' 
              ? pathname === '/dashboard/admin'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
              
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900',
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy-900 truncate">{user.name}</p>
              <p className="text-xs text-navy-500 truncate">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-btn text-sm font-medium text-error hover:bg-error-light transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 md:ml-sidebar min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-border flex items-center px-4 md:px-8 sticky top-0 z-10 shadow-sm gap-4">
          <button 
            className="md:hidden text-navy-500 hover:text-navy-900"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-navy-900 capitalize truncate">
            {pathname.split('/').pop() || 'Overview'}
          </h1>
        </header>

        {/* Page Content */}
        <div className="p-4 md:p-8 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
