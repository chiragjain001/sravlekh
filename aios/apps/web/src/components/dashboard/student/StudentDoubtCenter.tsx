'use client';

import { useState } from 'react';
import { MessageCircleQuestion, Plus, Bookmark, BookmarkCheck, ChevronRight, Search, X, Image as ImageIcon, Send } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';

export function StudentDoubtCenter() {
  const [activeTab, setActiveTab] = useState('My Doubts');
  const [doubts, setDoubts] = useState(d.doubts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newDoubt, setNewDoubt] = useState({ subject: 'Physics', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleBookmark = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDoubts(doubts.map(d => d.id === id ? { ...d, bookmarked: !d.bookmarked } : d));
  };

  const handleAskDoubt = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsModalOpen(false);
      setDoubts([{
        id: Math.random(),
        subject: newDoubt.subject,
        question: newDoubt.text,
        time: 'Just now',
        teacher: 'Assigning Teacher...',
        status: 'Pending',
        bookmarked: false,
      }, ...doubts]);
      setNewDoubt({ subject: 'Physics', text: '' });
    }, 1500);
  };

  const filteredDoubts = doubts.filter(d => {
    const matchesSearch = d.question.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'Answered') return matchesSearch && d.status === 'Answered';
    if (activeTab === 'Bookmarked') return matchesSearch && d.bookmarked;
    return matchesSearch;
  });

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <MessageCircleQuestion className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Doubt Center</h2>
              <p className="text-[12px] text-slate-500">Ask, get help, and clarify your doubts.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Doubt
          </button>
        </div>

        {/* Tabs & Search */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 mb-6 gap-4">
          <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
            {['My Doubts', 'Answered', 'Bookmarked'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-[13.5px] font-bold transition-all relative whitespace-nowrap ${
                  activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-indigo-600 rounded-t-full animate-fadein" />
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
              placeholder="Search doubts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
          {filteredDoubts.length > 0 ? filteredDoubts.map(doubt => {
            const subjectColor = doubt.subject === 'Physics' ? 'text-rose-500 bg-rose-50' : 
                                 doubt.subject === 'Mathematics' ? 'text-blue-500 bg-blue-50' : 
                                 'text-emerald-500 bg-emerald-50';
            
            const statusColor = doubt.status === 'Answered' ? 'text-emerald-600 bg-emerald-50' : 
                                doubt.status === 'In Review' ? 'text-amber-600 bg-amber-50' : 
                                'text-rose-600 bg-rose-50';

            return (
              <div key={doubt.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer group gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`px-2 py-1 rounded text-[10px] font-bold mt-1 ${subjectColor}`}>
                    {doubt.subject}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{doubt.question}</h4>
                    <p className="text-[12px] text-slate-400 mt-1">
                      {doubt.time} • <span className="font-medium text-slate-500">{doubt.teacher}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${statusColor}`}>
                    {doubt.status}
                  </span>
                  <div className="flex items-center gap-3 text-slate-400">
                    <button onClick={(e) => toggleBookmark(doubt.id, e)} className="hover:text-indigo-500 transition-colors">
                      {doubt.bookmarked ? <BookmarkCheck className="w-5 h-5 text-indigo-600" /> : <Bookmark className="w-5 h-5" />}
                    </button>
                    <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
              <MessageCircleQuestion className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-[14px] font-medium text-slate-500">No doubts found.</p>
            </div>
          )}
        </div>

        <div className="text-right">
          <button className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 transition-colors">
            View All Doubts <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Ask Doubt Modal */}
        {isModalOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadein">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <MessageCircleQuestion className="w-4 h-4" />
                  </div>
                  <h3 className="text-[16px] font-bold text-slate-800">Ask a New Doubt</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Select Subject</label>
                <div className="flex gap-3 mb-6">
                  {['Physics', 'Chemistry', 'Mathematics'].map(sub => (
                    <button
                      key={sub}
                      onClick={() => setNewDoubt({ ...newDoubt, subject: sub })}
                      className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all border ${
                        newDoubt.subject === sub ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>

                <label className="block text-[13px] font-bold text-slate-700 mb-2">Describe your doubt</label>
                <textarea 
                  rows={4}
                  value={newDoubt.text}
                  onChange={(e) => setNewDoubt({ ...newDoubt, text: e.target.value })}
                  placeholder="E.g., I don't understand how to calculate the moment of inertia for a hollow cylinder..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none mb-4"
                />

                <div className="flex items-center justify-between">
                  <button className="flex items-center gap-2 text-[13px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-3 py-2 rounded-lg hover:bg-indigo-50">
                    <ImageIcon className="w-4 h-4" /> Attach Image
                  </button>
                  <button 
                    onClick={handleAskDoubt}
                    disabled={isSubmitting || !newDoubt.text.trim()}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-xl transition-all disabled:opacity-70 flex items-center gap-2 shadow-sm"
                  >
                    {isSubmitting ? (
                      <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
                    ) : (
                      <><Send className="w-4 h-4" /> Ask Teacher</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
