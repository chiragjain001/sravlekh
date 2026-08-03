'use client';

import { useState } from 'react';
import { Search, FileText, Play, Book, FileQuestion, ClipboardList, Download, PlayCircle, FolderOpen, ArrowRight, BookOpen, Loader2 } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';

const iconMap = {
  'file-text': FileText,
  'play': Play,
  'book': Book,
  'file-question': FileQuestion,
  'clipboard-list': ClipboardList,
};

export function StudentResources() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeAction, setActiveAction] = useState<number | null>(null);

  const filters = ['All', 'Notes', 'Videos', 'Books', 'PYQs', 'Practice Sets'];

  const handleAction = (id: number) => {
    setActiveAction(id);
    setTimeout(() => {
      setActiveAction(null);
      // Would trigger download/play here
    }, 1500);
  };

  const filteredResources = d.allResources.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'All') return matchesSearch;
    return matchesSearch && r.category === activeFilter;
  });

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">
        
        {/* Header & Search */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-[22px] font-bold text-slate-800">Resources</h2>
            <p className="text-[13px] text-slate-500">All the study material you need, at one place.</p>
          </div>
          
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-all ${
                activeFilter === filter 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 hover:scale-105'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar pr-2 space-y-8 pb-4">
          
          {/* Quick Access */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[14px] font-bold text-slate-800">Quick Access</h3>
              <button onClick={() => setActiveFilter('All')} className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">View All</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {d.resourcesQuickAccess.map((item, idx) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap] || FileText;
                return (
                  <div 
                    key={idx} 
                    onClick={() => setActiveFilter(item.filter)}
                    className="border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/10 transition-all cursor-pointer group"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${item.bg} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                      <Icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <p className="text-[13px] font-bold text-slate-800 mb-0.5">{item.title}</p>
                    <p className="text-[11px] font-medium text-slate-400">{item.count}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Split Content: Recently Added & Top Collections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Resources List */}
            <section className="lg:col-span-2">
              <h3 className="text-[14px] font-bold text-slate-800 mb-4 animate-fadein" key={activeFilter}>
                {activeFilter === 'All' ? 'Recently Added' : `${activeFilter} Results`}
              </h3>
              <div className="space-y-3 animate-slide-up" key={activeFilter + searchQuery}>
                {filteredResources.length > 0 ? filteredResources.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl hover:bg-indigo-50/30 hover:border-indigo-100 transition-all group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${item.type === 'PDF' || item.type === 'Book' ? 'bg-rose-50' : 'bg-purple-50'}`}>
                        {item.type === 'PDF' || item.type === 'Book' ? <FileText className="w-5 h-5 text-rose-500" /> : <PlayCircle className="w-5 h-5 text-purple-500" />}
                      </div>
                      <div>
                        <h4 className="text-[13.5px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11.5px] text-slate-500">{item.subject}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${item.type === 'PDF' || item.type === 'Book' ? 'text-rose-600 bg-rose-50' : 'text-purple-600 bg-purple-50'}`}>
                            {item.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-slate-400 hidden sm:block">{item.date}</span>
                      <button 
                        onClick={() => handleAction(item.id)}
                        disabled={activeAction === item.id}
                        className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white hover:scale-110 transition-all disabled:opacity-50"
                      >
                        {activeAction === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : item.action === 'download' ? (
                          <Download className="w-4 h-4" /> 
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 text-slate-400">
                    <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-[13px] font-medium text-slate-500">No resources found.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Top Collections */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[14px] font-bold text-slate-800">Top Collections</h3>
                <button className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">View All</button>
              </div>
              <div className="space-y-4">
                {d.resourcesCollections.map((col, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border border-slate-100 flex items-center justify-between cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all duration-300 ${col.color}`}>
                    <div>
                      <h4 className="text-[14px] font-bold text-slate-800 mb-0.5">{col.title}</h4>
                      <p className="text-[11.5px] text-slate-600 mb-1">{col.subtitle}</p>
                      <p className="text-[10px] font-semibold text-slate-400">{col.count}</p>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <BookOpen className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

        </div>

        {/* Footer Request Banner */}
        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between border border-indigo-100/50 hover:shadow-lg transition-shadow duration-300 group">
            <div>
              <h4 className="text-[14px] font-bold text-indigo-900 mb-1">Can't find what you need?</h4>
              <p className="text-[12px] text-indigo-700/70">Request resources and we'll add them for you.</p>
              <button 
                onClick={() => {
                  const btn = document.getElementById('req-btn');
                  if(btn) { btn.innerHTML = 'Request Sent!'; btn.classList.add('bg-emerald-500'); }
                }}
                id="req-btn"
                className="mt-3 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-sm group-hover:scale-105"
              >
                Request Now
              </button>
            </div>
            <div className="hidden sm:flex items-center justify-center w-24 h-24">
              <FolderOpen className="w-16 h-16 text-indigo-300 drop-shadow-md group-hover:-translate-y-2 group-hover:rotate-6 transition-transform duration-500" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
