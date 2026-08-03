'use client';

import { useState } from 'react';
import { Plus, FileText, Trash2, Eye, CheckCircle2, X } from 'lucide-react';

interface Assignment {
  id: string; batchId: string; title: string;
  dueDate: string; totalStudents: number; submitted: number; status: string;
}

const statusStyle = (s: string) => ({
  active:    'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  draft:     'bg-slate-100 text-slate-500',
}[s] ?? 'bg-slate-100 text-slate-500');

export function BatchAssignments({ assignments, batchStrength }: {
  assignments: Assignment[];
  batchStrength: number;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [done, setDone]     = useState(false);
  const [form, setForm]     = useState({ title: '', dueDate: '', desc: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(true);
    setTimeout(() => { setShowCreate(false); setDone(false); setForm({ title: '', dueDate: '', desc: '' }); }, 1500);
  };

  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Assignments for this batch</h3>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Create Assignment
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 animate-fadein">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-slate-800">Create Assignment</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            {done ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <p className="text-[14px] font-bold text-slate-800">Assignment Created!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Title *</label>
                  <input required value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                    placeholder="e.g. Rotational Motion – NCERT Q1-Q15"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Due Date *</label>
                  <input required type="date" value={form.dueDate} onChange={e => setForm(p => ({...p, dueDate: e.target.value}))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Instructions</label>
                  <textarea rows={3} value={form.desc} onChange={e => setForm(p => ({...p, desc: e.target.value}))}
                    placeholder="What should students submit?"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700">Create & Assign</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {assignments.map(a => {
          const pct = batchStrength > 0 ? Math.round((a.submitted / batchStrength) * 100) : 0;
          return (
            <div key={a.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-800 leading-tight">{a.title}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">Due: <span className="font-semibold text-slate-700">{a.dueDate}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize ${statusStyle(a.status)}`}>{a.status}</span>
                  <button className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                  <button className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="text-slate-500">Submitted: <span className="font-bold text-slate-700">{a.submitted} / {batchStrength}</span></span>
                <span className={`font-bold ${pct===100?'text-emerald-600':pct>=50?'text-amber-600':'text-rose-600'}`}>{pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${pct===100?'bg-emerald-500':pct>=50?'bg-amber-500':'bg-rose-500'}`} style={{width:`${pct}%`}} />
              </div>
            </div>
          );
        })}
        {assignments.length === 0 && (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-[13px] font-semibold">No assignments yet. Create the first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
