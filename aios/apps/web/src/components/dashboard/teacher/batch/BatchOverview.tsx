'use client';

import { CheckCircle2, AlertTriangle, TrendingUp, Users, ClipboardList } from 'lucide-react';

interface Batch    { id: string; label: string; strength: number; avgScore: number; trend: string }
interface Briefing { severity: string; headline: string; reasoning: string; actions: { label: string }[] }
interface Student  { id: string; name: string; avgScore: number; status: string }
interface Test     { id: string; name: string; date: string; avgScore: number; status: string }

interface Props {
  batch:    Batch;
  briefing: Briefing | undefined;
  students: Student[];
  tests:    Test[];
}

const sev = (s: string) => ({
  good:     { bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, text: 'text-emerald-800' },
  warning:  { bg: 'bg-amber-50  border-amber-200',   icon: <AlertTriangle className="w-5 h-5 text-amber-500"  />, text: 'text-amber-800'  },
  critical: { bg: 'bg-rose-50   border-rose-200',    icon: <AlertTriangle className="w-5 h-5 text-rose-500"   />, text: 'text-rose-800'   },
}[s] ?? { bg: 'bg-slate-50 border-slate-200', icon: null, text: 'text-slate-700' });

export function BatchOverview({ batch, briefing, students, tests }: Props) {
  const weak = students.filter(s => s.status === 'weak' || s.status === 'average').length;
  const completed = tests.filter(t => t.status === 'completed' || t.status === 'grading');
  const style = briefing ? sev(briefing.severity) : null;

  return (
    <div className="space-y-6 animate-fadein">

      {/* AI Briefing */}
      {briefing && style && (
        <div className={`border rounded-2xl p-5 ${style.bg}`}>
          <div className="flex items-start gap-3 mb-3">
            {style.icon}
            <div>
              <p className={`text-[15px] font-bold leading-snug ${style.text}`}>{briefing.headline}</p>
              <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{briefing.reasoning}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-8">
            {briefing.actions.map((a, i) => (
              <button key={i} className="px-4 py-1.5 bg-white border border-slate-200 text-[12px] font-bold text-slate-700 rounded-xl hover:border-indigo-300 hover:text-indigo-700 transition-all shadow-sm">
                {a.label} →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Users className="w-4 h-4 text-indigo-500" />,       label: 'Students',     value: batch.strength,    color: 'text-slate-800' },
          { icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, label: 'Average Score', value: `${batch.avgScore}%`, color: batch.avgScore >= 75 ? 'text-emerald-600' : batch.avgScore >= 65 ? 'text-amber-600' : 'text-rose-600' },
          { icon: <AlertTriangle className="w-4 h-4 text-rose-500" />, label: 'Need Help',     value: weak,              color: weak > 0 ? 'text-rose-600' : 'text-emerald-600' },
        ].map((k, i) => (
          <div key={i} className="card border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">{k.icon}<p className="text-[11px] text-slate-500">{k.label}</p></div>
            <p className={`text-[24px] font-black leading-tight ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Tests */}
      {completed.length > 0 && (
        <div className="card border border-slate-100 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-slate-50">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            <h3 className="text-[14px] font-bold text-slate-800">Recent Tests</h3>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Test</th>
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden sm:table-cell">Date</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Avg</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {completed.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-5 font-semibold text-slate-800">{t.name}</td>
                  <td className="py-3.5 px-3 text-slate-500 hidden sm:table-cell">{t.date}</td>
                  <td className="py-3.5 px-3 text-center font-bold">
                    <span className={t.avgScore >= 75 ? 'text-emerald-600' : t.avgScore >= 60 ? 'text-amber-600' : 'text-rose-600'}>{t.avgScore}%</span>
                  </td>
                  <td className="py-3.5 px-5 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${t.status === 'grading' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {t.status === 'grading' ? 'Grading' : 'Completed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
