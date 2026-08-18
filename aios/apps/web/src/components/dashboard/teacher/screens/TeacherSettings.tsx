'use client';

import { useState, type ElementType } from 'react';
import { User, Bell, Shield, Mail, Phone, BookOpen, Calendar, CheckCircle2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { teacherProfile } from '@/lib/mock-data/teacher';
import { useAuth } from '@/contexts/auth.context';
import { ConfirmDialog } from '@/components/ui/foundation';

const TABS = ['Profile', 'Preferences', 'Security'] as const;
type Tab = typeof TABS[number];

export function TeacherSettings() {
  const { logout } = useAuth();
  const [tab, setTab]           = useState<Tab>('Profile');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNot] = useState(() => {
    // Rehydrate from localStorage if previously saved
    try {
      const stored = localStorage.getItem('aios_teacher_notif_prefs');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return {
      doubts:      true,
      submissions: true,
      testRemind:  true,
      weeklyDigest:false,
    };
  });


  const toggle = (k: keyof typeof notifications) =>
    setNot((prev: typeof notifications) => ({ ...prev, [k]: !prev[k] }));

  const handleSavePreferences = () => {
    try {
      localStorage.setItem('aios_teacher_notif_prefs', JSON.stringify(notifications));
      toast.success('Preferences saved successfully.');
    } catch {
      toast.error('Failed to save preferences.');
    }
  };

  return (
    <div className="p-6 animate-fadein space-y-6">
      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Log out of all devices"
        description="This will immediately end all active sessions across every device. You will need to log in again."
        confirmLabel="Log Out Everywhere"
        variant="danger"
        onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Settings</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Manage your account preferences and notification settings.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar tabs */}
        <div className="w-full lg:w-56 flex flex-row lg:flex-col gap-2">
          {([
            { id: 'Profile',     icon: User,   sub: 'Your information'     },
            { id: 'Preferences', icon: Bell,   sub: 'Notifications'        },
            { id: 'Security',    icon: Shield, sub: 'Connected accounts'   },
          ] as { id: Tab; icon: ElementType; sub: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                tab === t.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'border border-transparent hover:bg-slate-50'
              }`}>
              <t.icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tab === t.id ? 'text-indigo-600' : 'text-slate-400'}`} />
              <div className="hidden lg:block">
                <p className={`text-[13.5px] font-bold ${tab === t.id ? 'text-indigo-900' : 'text-slate-700'}`}>{t.id}</p>
                <p className="text-[11px] text-slate-500">{t.sub}</p>
              </div>
              <p className={`lg:hidden text-[13px] font-bold ${tab === t.id ? 'text-indigo-900' : 'text-slate-700'}`}>{t.id}</p>
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-2xl">

          {/* ── Profile ──────────────────────────────────────────────────── */}
          {tab === 'Profile' && (
            <div className="space-y-6 animate-fadein">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800">Personal Information</h3>
                <p className="text-[12.5px] text-slate-500 mt-0.5">Your profile is managed by the institute administration. Contact your admin to make changes.</p>
              </div>

              <div className="flex items-center gap-5 p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[22px] font-black">
                  {teacherProfile.avatarInitials}
                </div>
                <div>
                  <p className="text-[18px] font-bold text-slate-800">{teacherProfile.name}</p>
                  <p className="text-[13px] text-slate-500">{teacherProfile.designation}</p>
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Active Teacher
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Email',            icon: Mail,     value: teacherProfile.email      },
                  { label: 'Phone',            icon: Phone,    value: teacherProfile.phone      },
                  { label: 'Subject',          icon: BookOpen, value: 'Physics'                 },
                  { label: 'Employee ID',      icon: User,     value: teacherProfile.id         },
                  { label: 'Batches Assigned', icon: BookOpen, value: '11A, 11B, 11C, 12A, 12B, 12C' },
                  { label: 'Joined On',        icon: Calendar, value: teacherProfile.joinedOn   },
                ].map(f => (
                  <div key={f.label} className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <f.icon className="w-3.5 h-3.5" /> {f.label}
                    </label>
                    <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[13px] text-slate-700 font-medium">
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Preferences ──────────────────────────────────────────────── */}
          {tab === 'Preferences' && (
            <div className="space-y-5 animate-fadein">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800">Notification Preferences</h3>
                <p className="text-[12.5px] text-slate-500 mt-0.5">Choose which events trigger notifications.</p>
              </div>

              <div className="space-y-3">
                {([
                  { key: 'doubts',       label: 'New Doubt Submitted',       desc: 'When a student submits a doubt to you'   },
                  { key: 'submissions',  label: 'Assignment Submissions',     desc: 'When students submit assignments'        },
                  { key: 'testRemind',   label: 'Test Reminders',            desc: 'Reminder 24 hours before a scheduled test'},
                  { key: 'weeklyDigest', label: 'Weekly Performance Summary', desc: 'A weekly digest of your class performance'},
                ] as { key: keyof typeof notifications & string; label: string; desc: string }[]).map(s => (
                  <div key={s.key} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                    <div>
                      <p className="text-[13.5px] font-bold text-slate-800">{s.label}</p>
                      <p className="text-[12px] text-slate-500 mt-0.5">{s.desc}</p>
                    </div>
                    <button onClick={() => toggle(s.key)}
                      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${notifications[s.key] ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-all ${notifications[s.key] ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={handleSavePreferences}
                className="px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                Save Preferences
              </button>
            </div>
          )}

          {/* ── Security ─────────────────────────────────────────────────── */}
          {tab === 'Security' && (
            <div className="space-y-6 animate-fadein">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800">Security Settings</h3>
                <p className="text-[12.5px] text-slate-500 mt-0.5">Manage your connected account and active sessions.</p>
              </div>

              {/* Google SSO */}
              <div className="border border-slate-100 rounded-2xl p-5">
                <h4 className="text-[14px] font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" /> Authentication Provider
                </h4>
                <p className="text-[12.5px] text-slate-500 mb-4">
                  Your account uses Google Single Sign-On (SSO). There is no password — authentication is handled entirely by Google.
                </p>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 p-2">
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">Google Account</p>
                    <p className="text-[12px] text-slate-500">{teacherProfile.email}</p>
                  </div>
                  <span className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                </div>
              </div>

              {/* Session */}
              <div className="border border-rose-100 rounded-2xl p-5 bg-rose-50/30">
                <h4 className="text-[14px] font-bold text-rose-800 mb-2 flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Active Sessions
                </h4>
                <p className="text-[12.5px] text-rose-600/80 mb-4">If you notice any suspicious activity, you can log out of all other devices immediately.</p>
                <button onClick={() => setShowLogoutConfirm(true)} className="px-5 py-2 bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white text-[12px] font-bold rounded-xl transition-colors">
                  Log out of all devices
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
