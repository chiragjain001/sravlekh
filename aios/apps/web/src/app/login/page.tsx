'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { GraduationCap, Briefcase, Shield, Crown, ArrowRight, Zap } from 'lucide-react';

const ROLES = [
  {
    id: 'student',
    label: 'Student',
    subtitle: 'Aryan Sharma — Class 11 JEE',
    icon: GraduationCap,
    color: 'indigo',
    route: '/dashboard/student',
    gradientFrom: '#6366f1',
    gradientTo: '#4f46e5',
    badge: 'STUDENT',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    subtitle: 'Rahul Verma — Physics Teacher',
    icon: Briefcase,
    color: 'emerald',
    route: '/dashboard/teacher',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    badge: 'TEACHER',
  },
  {
    id: 'admin',
    label: 'Institute Admin',
    subtitle: 'Neha Malhotra — Admin',
    icon: Shield,
    color: 'sky',
    route: '/dashboard/admin',
    gradientFrom: '#0ea5e9',
    gradientTo: '#0284c7',
    badge: 'ADMIN',
  },
  {
    id: 'founder',
    label: 'Super Admin',
    subtitle: 'Platform Owner',
    icon: Crown,
    color: 'violet',
    route: '/dashboard/founder',
    gradientFrom: '#8b5cf6',
    gradientTo: '#7c3aed',
    badge: 'FOUNDER',
  },
];

const COLOR_CLASSES: Record<string, string> = {
  indigo:  'bg-indigo-50  border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50',
  emerald: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50',
  sky:     'bg-sky-50     border-sky-200     hover:border-sky-400     hover:bg-sky-50',
  violet:  'bg-violet-50  border-violet-200  hover:border-violet-400  hover:bg-violet-50',
};

const ICON_COLOR_CLASSES: Record<string, string> = {
  indigo:  'text-indigo-600',
  emerald: 'text-emerald-600',
  sky:     'text-sky-600',
  violet:  'text-violet-600',
};

const BADGE_COLOR_CLASSES: Record<string, string> = {
  indigo:  'bg-indigo-100  text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  sky:     'bg-sky-100     text-sky-700',
  violet:  'bg-violet-100  text-violet-700',
};

export default function LoginPage() {
  const { loginAsMock } = useAuth();

  const handleRoleSelect = (badge: string) => {
    loginAsMock(badge as 'STUDENT' | 'TEACHER' | 'ADMIN' | 'FOUNDER');
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-xl px-4 py-2 mb-6">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">AIOS</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            Academic Intelligence OS
          </h1>
          <p className="text-slate-400 text-[15px]">
            Select your role to access your personalised dashboard
          </p>

          <div className="inline-flex items-center gap-1.5 mt-4 bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 text-[12px] font-medium">Testing Mode — No auth required</span>
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.badge)}
                className={`group relative flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left 
                  ${COLOR_CLASSES[role.color]} hover:shadow-xl hover:-translate-y-0.5 cursor-pointer bg-white`}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${role.gradientFrom}, ${role.gradientTo})` }}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-[15px] font-bold text-slate-800">{role.label}</h3>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${BADGE_COLOR_CLASSES[role.color]}`}>
                      {role.badge}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-slate-500">{role.subtitle}</p>
                </div>

                {/* Arrow */}
                <ArrowRight className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_COLOR_CLASSES[role.color]} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200`} />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-[12px] mt-8">
          Production deployment requires Google SSO authentication.
          <br />
          Role-based access control is enforced server-side.
        </p>
      </div>
    </div>
  );
}
