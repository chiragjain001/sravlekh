'use client';

import { useState } from 'react';
import { FileText, ChevronRight, FileCheck, FileClock, FileWarning, Search, UploadCloud, CheckCircle2, X } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';

const iconMap = {
  check: FileCheck,
  warning: FileWarning,
  clock: FileClock,
  text: FileText,
};

export function StudentAssignments() {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitModalOpen, setSubmitModalOpen] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simulated submission handler
  const handleSubmit = (title: string) => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitModalOpen(null);
      // In a real app, this would mutate global state or invalidate queries
      alert(`Successfully submitted: ${title}`);
    }, 1500);
  };

  const filteredAssignments = d.assignments.filter((a) => {
    const matchesTab = a.status === activeTab;
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });
  
  const counts = {
    pending: d.assignments.filter((a) => a.status === 'pending').length,
    submitted: d.assignments.filter((a) => a.status === 'submitted').length,
    completed: d.assignments.filter((a) => a.status === 'completed').length,
  };

  const total = counts.pending + counts.submitted + counts.completed;
  const progress = Math.round(((counts.submitted + counts.completed) / total) * 100);

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">
        
        {/* Header & Progress */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Assignments</h2>
              <p className="text-[12px] text-slate-500">Track and submit your coursework.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                <span>Weekly Progress</span>
                <span className="text-emerald-600">{progress}%</span>
              </div>
              <div className="w-32 bg-slate-200 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Controls: Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 mb-6 gap-4">
          <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
            {[
              { id: 'pending', label: `Pending (${counts.pending})` },
              { id: 'submitted', label: `Submitted (${counts.submitted})` },
              { id: 'completed', label: `Completed (${counts.completed})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-[13.5px] font-bold transition-all relative whitespace-nowrap ${
                  activeTab === tab.id ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-emerald-500 rounded-t-full animate-fadein" />
                )}
              </button>
            ))}
          </div>

          <div className="relative pb-2 sm:pb-3 w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none pb-2 sm:pb-3">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((item, idx) => {
              const Icon = iconMap[item.type as keyof typeof iconMap] || FileText;
              return (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100 group gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${item.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{item.subject}</span>
                        <span className="text-[12px] text-slate-400">• {item.detail}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3">
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] text-slate-400 mb-0.5">{item.status === 'pending' ? 'Due in' : 'Status'}</p>
                      <p className={`text-[13px] font-bold ${item.dueColor}`}>{item.due}</p>
                    </div>
                    {item.status === 'pending' && (
                      <button 
                        onClick={() => setSubmitModalOpen(item.title)}
                        className="px-4 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white text-[12px] font-bold rounded-lg transition-colors border border-emerald-100 hover:border-emerald-500"
                      >
                        Submit
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
              <FileCheck className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-[14px] font-medium text-slate-500">No assignments found.</p>
              {searchQuery && <p className="text-[12px] mt-1">Try adjusting your search query.</p>}
            </div>
          )}
        </div>
        
        {/* Simulated Submit Modal overlay */}
        {submitModalOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-fadein p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-slide-up">
              <button 
                onClick={() => !isSubmitting && setSubmitModalOpen(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <UploadCloud className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-[18px] font-bold text-slate-800 mb-1">Submit Assignment</h3>
              <p className="text-[13px] text-slate-500 mb-6 font-medium">{submitModalOpen}</p>
              
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors cursor-pointer mb-6 group">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3 group-hover:text-emerald-400 transition-colors" />
                <p className="text-[13px] font-bold text-slate-700">Click to browse or drag file here</p>
                <p className="text-[11px] text-slate-400 mt-1">PDF, DOCX, or Images up to 10MB</p>
              </div>
              
              <button 
                onClick={() => handleSubmit(submitModalOpen)}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...
                  </span>
                ) : (
                  <> <CheckCircle2 className="w-4 h-4" /> Submit Work</>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
