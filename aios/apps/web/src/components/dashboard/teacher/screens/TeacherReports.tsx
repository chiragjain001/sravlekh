'use client';

import { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { generatedReports } from '@/lib/mock-data/teacher';

const REPORT_TYPES = [
  { id: 'batch',   name: 'Batch Performance Report',    desc: 'Complete performance summary for a selected batch with test scores and weak topics.', color: 'indigo',  fields: ['batch'] },
  { id: 'student', name: 'Student Progress Report',     desc: 'Individual student performance over time — ideal for parent-teacher meetings.',      color: 'sky',     fields: ['batch', 'student'] },
  { id: 'test',    name: 'Test Analysis Report',        desc: 'Detailed per-test breakdown: score distribution, toppers, and weak question areas.',  color: 'violet',  fields: ['test'] },
  { id: 'topic',   name: 'Topic Coverage Report',       desc: 'Which topics have been taught and tested, and which need more attention.',            color: 'emerald', fields: ['batch'] },
  { id: 'assign',  name: 'Assignment Submission Report',desc: 'Track submission rates and pending assignments across all your batches.',             color: 'amber',   fields: ['batch'] },
];

const colorMap: Record<string, string> = {
  indigo:  'bg-indigo-50  text-indigo-600  border-indigo-100',
  sky:     'bg-sky-50     text-sky-600     border-sky-100',
  violet:  'bg-violet-50  text-violet-600  border-violet-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  amber:   'bg-amber-50   text-amber-600   border-amber-100',
};

export function TeacherReports() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [done,       setDone]       = useState<string[]>([]);
  const [downloading,setDownloading]= useState<string | null>(null);

  // Dynamic filter state for report generation
  const [selectedBatch, setSelectedBatch] = useState<string>('11A');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedTest, setSelectedTest] = useState<string>('wt-07');

  const handleGenerate = (id: string) => {
    if (done.includes(id)) return;
    setGenerating(id);
    setTimeout(() => { setGenerating(null); setDone(prev => [...prev, id]); }, 2000);
  };

  const handleDownload = (id: string) => {
    setDownloading(id);
    setTimeout(() => setDownloading(null), 1500);
  };

  return (
    <div className="p-6 animate-fadein space-y-8">
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Reports</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Generate and download performance reports for your batches and students.</p>
      </div>

      {/* Global Filter Bar for Reports */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Batch</label>
          <select
            value={selectedBatch}
            onChange={e => setSelectedBatch(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          >
            <option value="11A">Batch 11A</option>
            <option value="11B">Batch 11B</option>
            <option value="12A">Batch 12A</option>
            <option value="12B">Batch 12B</option>
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Student</label>
          <select
            value={selectedStudent}
            onChange={e => setSelectedStudent(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          >
            <option value="all">All Batch Students</option>
            <option value="stu-1">Aarav Sharma (Roll 101)</option>
            <option value="stu-2">Diya Patel (Roll 102)</option>
            <option value="stu-3">Rohan Verma (Roll 103)</option>
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Test</label>
          <select
            value={selectedTest}
            onChange={e => setSelectedTest(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          >
            <option value="wt-07">Physics Weekly Test 07</option>
            <option value="wt-06">Physics Weekly Test 06</option>
            <option value="mock-01">JEE Main Full Mock 01</option>
          </select>
        </div>
      </div>

      {/* Generate */}
      <div>
        <h2 className="text-[15px] font-bold text-slate-800 mb-1">Generate Report</h2>
        <p className="text-[12.5px] text-slate-500 mb-4">Choose a report type and generate it as a PDF for Batch {selectedBatch}.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_TYPES.map(rt => {
            const isGenerating = generating === rt.id;
            const isDone       = done.includes(rt.id);
            return (
              <div key={rt.id} className={`card border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md ${isDone ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorMap[rt.color]}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-slate-800 leading-tight">{rt.name}</p>
                    <p className="text-[11.5px] text-slate-500 mt-1 leading-snug">{rt.desc}</p>
                  </div>
                </div>
                <button onClick={() => handleGenerate(rt.id)} disabled={isGenerating || isDone}
                  className={`w-full py-2.5 text-[12.5px] font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                    isDone       ? 'bg-emerald-100 text-emerald-700 cursor-default'        :
                    isGenerating ? 'bg-slate-100 text-slate-500 cursor-wait'               :
                                   'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  }`}>
                  {isGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                  : isDone       ? <>✓ Ready — Download Below</>
                  :                <>Generate Report</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-[15px] font-bold text-slate-800 mb-1">Generated Reports</h2>
        <p className="text-[12.5px] text-slate-500 mb-4">Previously generated reports available for download.</p>
        <div className="card border border-slate-100 rounded-2xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Report</th>
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden sm:table-cell">Type</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden md:table-cell">Generated</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden md:table-cell">Size</th>
                <th className="text-right py-3 px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {generatedReports.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                        <FileText className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-slate-800">{r.name}</p>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-slate-500 hidden sm:table-cell capitalize">{r.type}</td>
                  <td className="py-4 px-3 text-center text-slate-500 hidden md:table-cell">{r.generatedOn}</td>
                  <td className="py-4 px-3 text-center text-slate-500 hidden md:table-cell">{r.sizeMb} MB</td>
                  <td className="py-4 px-5 text-right">
                    <button onClick={() => handleDownload(r.id)}
                      className="flex items-center gap-1.5 ml-auto px-3.5 py-2 bg-slate-800 text-white text-[11.5px] font-bold rounded-xl hover:bg-slate-900 transition-colors">
                      {downloading === r.id
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Downloading...</>
                        : <><Download className="w-3.5 h-3.5" /> Download PDF</>
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
