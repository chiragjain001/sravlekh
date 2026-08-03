'use client';

import { useState } from 'react';
import { User, Bell, Lock, Smartphone, Mail, Calendar, BookOpen, Shield, LogOut, CheckCircle2 } from 'lucide-react';

export function StudentSettings() {
  const [activeTab, setActiveTab] = useState('Profile');
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    testReminders: true,
    weeklyReports: true,
  });

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-[22px] font-bold text-slate-800">Settings</h2>
          <p className="text-[13px] text-slate-500">Manage your account preferences and security.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 h-full">
          
          {/* Sidebar Navigation */}
          <div className="w-full lg:w-64 flex flex-col gap-2">
            {[
              { id: 'Profile', icon: User, desc: 'Your personal information' },
              { id: 'Preferences', icon: Bell, desc: 'Notifications and UI' },
              { id: 'Security', icon: Shield, desc: 'Passwords and sessions' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-start gap-4 p-4 rounded-2xl transition-all text-left ${
                  activeTab === tab.id 
                    ? 'bg-indigo-50 border border-indigo-100 shadow-sm' 
                    : 'bg-transparent border border-transparent hover:bg-slate-50'
                }`}
              >
                <div className={`mt-0.5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <tab.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className={`text-[14px] font-bold ${activeTab === tab.id ? 'text-indigo-900' : 'text-slate-700'}`}>{tab.id}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{tab.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto pr-2 custom-scrollbar">
            
            {/* PROFILE TAB */}
            {activeTab === 'Profile' && (
              <div className="animate-fadein max-w-2xl">
                <div className="mb-6">
                  <h3 className="text-[16px] font-bold text-slate-800">Personal Information</h3>
                  <p className="text-[12.5px] text-slate-500">Your profile information is managed by the administration. Contact support if changes are needed.</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[24px] font-bold shadow-inner">
                    Y
                  </div>
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-800">You (Student)</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-100 text-emerald-700 text-[11px] font-bold mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active Student
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email Address
                    </label>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[13.5px] text-slate-700 font-medium">
                      student@sarvlekh.com
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" /> Phone Number
                    </label>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[13.5px] text-slate-700 font-medium">
                      +91 98765 43210
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Enrolled Batch
                    </label>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[13.5px] text-slate-700 font-medium">
                      JEE Target 2025 (Class 12)
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Date Joined
                    </label>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[13.5px] text-slate-700 font-medium">
                      April 12, 2024
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREFERENCES TAB */}
            {activeTab === 'Preferences' && (
              <div className="animate-fadein max-w-2xl">
                <div className="mb-6">
                  <h3 className="text-[16px] font-bold text-slate-800">Notification Preferences</h3>
                  <p className="text-[12.5px] text-slate-500">Choose how and when you want to be notified.</p>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'email', label: 'Email Notifications', desc: 'Receive important updates via email' },
                    { id: 'sms', label: 'SMS Alerts', desc: 'Get text messages for critical alerts' },
                    { id: 'testReminders', label: 'Test Reminders', desc: 'Notify me 24 hours before an upcoming test' },
                    { id: 'weeklyReports', label: 'Weekly Performance Reports', desc: 'Receive a summary of your week\'s progress' },
                  ].map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
                      <div>
                        <h4 className="text-[14px] font-bold text-slate-800">{setting.label}</h4>
                        <p className="text-[12px] text-slate-500 mt-0.5">{setting.desc}</p>
                      </div>
                      <button 
                        onClick={() => setNotifications(prev => ({ ...prev, [setting.id]: !prev[setting.id as keyof typeof prev] }))}
                        className={`w-11 h-6 rounded-full transition-colors relative ${notifications[setting.id as keyof typeof notifications] ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform ${notifications[setting.id as keyof typeof notifications] ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <button className="px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'Security' && (
              <div className="animate-fadein max-w-2xl">
                <div className="mb-6">
                  <h3 className="text-[16px] font-bold text-slate-800">Security Settings</h3>
                  <p className="text-[12.5px] text-slate-500">Manage your connected accounts and active sessions.</p>
                </div>

                <div className="border border-slate-100 rounded-2xl p-6 mb-8">
                  <h4 className="text-[14px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" /> Authentication Provider
                  </h4>
                  <p className="text-[12.5px] text-slate-500 mb-5">Your account is securely authenticated via Google Single Sign-On (SSO). Password management is handled by your Google account.</p>
                  
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 p-2.5">
                      <svg viewBox="0 0 24 24" className="w-full h-full">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-800">Google Account</p>
                      <p className="text-[12px] text-slate-500">student@sarvlekh.com</p>
                    </div>
                    <div className="ml-auto">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border border-rose-100 rounded-2xl p-6 bg-rose-50/30">
                  <h4 className="text-[14px] font-bold text-rose-800 mb-2 flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Active Sessions
                  </h4>
                  <p className="text-[12.5px] text-rose-600/80 mb-4">If you notice suspicious activity, you can log out of all other devices.</p>
                  <button className="px-5 py-2 bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white text-[12px] font-bold rounded-xl transition-colors">
                    Log out of all devices
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
