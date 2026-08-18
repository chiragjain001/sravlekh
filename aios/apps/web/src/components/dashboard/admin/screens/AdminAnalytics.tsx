'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
  AreaChart, Area
} from 'recharts';
import { Download, TrendingUp, BarChart3, Users, DollarSign } from 'lucide-react';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';

const REVENUE_DATA = [
  { month: 'Jan', revenue: 450000, target: 500000 },
  { month: 'Feb', revenue: 520000, target: 500000 },
  { month: 'Mar', revenue: 480000, target: 500000 },
  { month: 'Apr', revenue: 610000, target: 600000 },
  { month: 'May', revenue: 590000, target: 600000 },
  { month: 'Jun', revenue: 680000, target: 650000 },
];

const ENROLLMENT_DATA = [
  { month: 'Jan', students: 120 },
  { month: 'Feb', students: 145 },
  { month: 'Mar', students: 130 },
  { month: 'Apr', students: 180 },
  { month: 'May', students: 195 },
  { month: 'Jun', students: 220 },
];

export function AdminAnalytics() {
  const [activeModal, setActiveModal] = useState<'export' | 'revenueDetail' | 'enrollmentDetail' | null>(null);

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-slate-800">Analytics &amp; Intelligence Reports</h2>
          <p className="text-[13px] text-slate-500">Deep dive into financial, enrollment, and academic metrics.</p>
        </div>
        <button 
          onClick={() => setActiveModal('export')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" /> Export Executive Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue Chart */}
        <div 
          onClick={() => setActiveModal('revenueDetail')}
          className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Revenue vs Target</p>
              <p className="text-[24px] font-black text-slate-800 mt-1">₹33.3L</p>
              <p className="text-[12px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" /> +12% from last quarter
              </p>
            </div>
            <span className="text-xs text-blue-600 font-bold hover:underline">View Breakdown →</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={REVENUE_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="revenue" name="Actual Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="target" name="Target Revenue" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Enrollment Trend */}
        <div 
          onClick={() => setActiveModal('enrollmentDetail')}
          className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">New Enrollments Trend</p>
              <p className="text-[24px] font-black text-slate-800 mt-1">990</p>
              <p className="text-[12px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" /> +24% growth
              </p>
            </div>
            <span className="text-xs text-blue-600 font-bold hover:underline">View Cohort Trends →</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={ENROLLMENT_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Area type="monotone" dataKey="students" name="New Students" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── OVERLAP MODALS ── */}

      {/* Export Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'export'}
        onClose={() => setActiveModal(null)}
        title="Export Analytics & Executive Reports"
        subtitle="Download financial, enrollment, and performance reports in PDF/CSV format"
        icon={Download}
        badgeText="Executive Export"
      >
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Q2 Financial &amp; Fee Collection Summary</h4>
              <p className="text-[11px] text-slate-500">Includes revenue vs target breakdown and outstanding dues</p>
            </div>
            <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">Download PDF</button>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Annual Student Enrollment &amp; Retention Audit</h4>
              <p className="text-[11px] text-slate-500">Month-over-month growth data across all 48 batches</p>
            </div>
            <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">Download CSV</button>
          </div>
        </div>
      </AdminOverlapModal>

      {/* Revenue Detail Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'revenueDetail'}
        onClose={() => setActiveModal(null)}
        title="Revenue Breakdown & Target Audit"
        subtitle="Detailed monthly fee collections vs targets"
        icon={DollarSign}
        badgeText="₹33.3L Total Revenue"
      >
        <div className="space-y-3">
          {REVENUE_DATA.map((row, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{row.month} 2025</h4>
                <p className="text-[11px] text-slate-500">Target: ₹{(row.target / 1000).toFixed(0)}k</p>
              </div>
              <span className={`text-xs font-bold ${row.revenue >= row.target ? 'text-emerald-600' : 'text-amber-600'}`}>
                ₹{(row.revenue / 1000).toFixed(0)}k {row.revenue >= row.target ? '✓ Target Met' : 'Under Target'}
              </span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* Enrollment Detail Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'enrollmentDetail'}
        onClose={() => setActiveModal(null)}
        title="Student Enrollment Growth Audit"
        subtitle="Month-over-month new student registration trends"
        icon={Users}
        badgeText="990 Total Enrollments"
      >
        <div className="space-y-3">
          {ENROLLMENT_DATA.map((row, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-900">{row.month} 2025</span>
              <span className="text-xs font-bold text-emerald-600">+{row.students} New Students</span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

    </div>
  );
}
