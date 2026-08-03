'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Lightbulb, PlayCircle, BookOpen, X, Sparkles, ChevronRight } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { studentData as d } from '@/lib/mock-data/student';

export function StudentWeakTopics() {
  const [selectedTopic, setSelectedTopic] = useState<typeof d.weakTopicsDetailed[0] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleGenerateAI = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setAiGenerated(true);
    }, 2000);
  };

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Weak Topics</h2>
              <p className="text-[12px] text-slate-500">Targeted insights to boost your score.</p>
            </div>
          </div>
          <button className="text-[14px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors hidden sm:block">
            View All History
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 mb-8 flex-1">
          
          {/* Left: Radar Chart */}
          <div className="flex flex-col h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6 text-center lg:text-left">Your Weakness Overview</h3>
            <div className="flex-1 min-h-[250px] w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={d.radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontWeight: 'bold' }} cursor={{ fill: '#f43f5e', opacity: 0.05 }} />
                    <Radar name="Mastery" dataKey="A" stroke="#f43f5e" strokeWidth={2.5} fill="#f43f5e" fillOpacity={0.15} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right: Top Weak Topics */}
          <div className="flex flex-col h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6 flex justify-between items-center">
              Top Priority Areas
            </h3>
            <div className="space-y-4">
              {d.weakTopicsDetailed.map((topic, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedTopic(topic)}
                  className="group cursor-pointer p-3 -mx-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13.5px] font-bold text-slate-700 group-hover:text-rose-600 transition-colors">{topic.name}</span>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="text-[13px] font-bold text-slate-800">{topic.score}%</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${topic.chipClass}`}>
                        {topic.level}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all -ml-2" />
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-[4px]">
                    <div className={`h-[4px] rounded-full ${topic.color} transition-all duration-1000`} style={{ width: `${topic.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: AI Recommended Action */}
        <div className={`border rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all duration-500 ${aiGenerated ? 'bg-indigo-50/80 border-indigo-200' : 'bg-rose-50/50 border-rose-100/60'}`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${aiGenerated ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-500'}`}>
              {aiGenerated ? <Sparkles className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
            </div>
            <div>
              <p className={`text-[14.5px] font-bold ${aiGenerated ? 'text-indigo-900' : 'text-slate-800'}`}>
                {aiGenerated ? 'AI Personalized Path Ready' : 'AI Analysis Recommended'}
              </p>
              <p className="text-[13px] text-slate-600 mt-1 max-w-xl">
                {aiGenerated 
                  ? "Based on your recent tests, we've compiled a tailored playlist of 3 micro-lectures and 15 targeted practice questions specifically for Rotational Motion and Integrals."
                  : "You've been consistently struggling with Rotational Motion. Allow our AI to analyze your recent mistakes and generate a custom intervention plan."}
              </p>
            </div>
          </div>
          <button 
            onClick={!aiGenerated ? handleGenerateAI : undefined}
            disabled={isGenerating}
            className={`whitespace-nowrap px-6 py-3 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 ${aiGenerated ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-500 hover:bg-rose-600'} disabled:opacity-80`}
          >
            {isGenerating ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
            ) : aiGenerated ? (
              <><PlayCircle className="w-4 h-4"/> Start Playlist</>
            ) : (
              <><Sparkles className="w-4 h-4"/> Generate Plan</>
            )}
          </button>
        </div>

        {/* Topic Detail Modal */}
        {selectedTopic && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center animate-fadein sm:p-4">
            <div className="bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 relative animate-slide-up">
              <button 
                onClick={() => setSelectedTopic(null)}
                className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${selectedTopic.level === 'High' ? 'bg-rose-50' : 'bg-amber-50'}`}>
                <AlertCircle className={`w-6 h-6 ${selectedTopic.level === 'High' ? 'text-rose-600' : 'text-amber-600'}`} />
              </div>
              
              <h3 className="text-[20px] font-bold text-slate-800 mb-1">{selectedTopic.name}</h3>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[13px] text-slate-500 font-medium">Mastery: {selectedTopic.score}%</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${selectedTopic.chipClass}`}>Priority: {selectedTopic.level}</span>
              </div>
              
              <h4 className="text-[14px] font-bold text-slate-800 mb-3">Recommended Resources</h4>
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-100 cursor-pointer transition-all group">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                    <PlayCircle className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-700 group-hover:text-indigo-700">Concept Review Video</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">15 mins • Core concepts explained</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl hover:bg-emerald-50/50 hover:border-emerald-100 cursor-pointer transition-all group">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                    <BookOpen className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-700 group-hover:text-emerald-700">Targeted Practice Set</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">20 Questions • Adaptive difficulty</p>
                  </div>
                </div>
              </div>
              
              <button className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[14px] rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                Start Remediation
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
