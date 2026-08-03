'use client';

import { useState } from 'react';
import { useDoubts } from '@/hooks/useApi';
import { HelpCircle, Send, Sparkles, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export function StudentDoubts() {
  const { data: doubtsData, isLoading } = useDoubts();
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  // Use mock data if API is empty for demo
  const doubts = doubtsData?.data?.length ? doubtsData.data : [
    { id: 1, title: 'How to calculate tension in string?', status: 'RESOLVED', createdAt: new Date(Date.now() - 172800000).toISOString() },
    { id: 2, title: 'I do not understand integration limits.', status: 'OPEN', createdAt: new Date().toISOString() }
  ];

  const handleAsk = () => {
    if (!question.trim()) return;
    setIsAsking(true);
    setTimeout(() => {
      toast.success('Your doubt was answered by the AI Tutor!');
      setIsAsking(false);
      setQuestion('');
    }, 1500);
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <div className="bg-gradient-to-r from-warning/10 to-orange-50 border border-warning/20 p-6 rounded-2xl">
        <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-warning" /> AI Doubt Tutor
        </h2>
        <p className="text-sm text-navy-700 mb-4">Ask any academic question and get instant step-by-step guidance.</p>
        
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1 bg-white"
            placeholder="Type your question here (e.g. What is Bernoulli's principle?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button 
            onClick={handleAsk}
            disabled={isAsking || !question.trim()}
            className="btn-primary bg-warning hover:bg-yellow-500 text-white border-none min-w-[100px]"
          >
            {isAsking ? 'Thinking...' : <><Send className="w-4 h-4 mr-1" /> Ask</>}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-navy-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-navy-400" /> Past Doubts
        </h3>
        
        {isLoading ? (
          <div className="text-center text-navy-500 py-4">Loading history...</div>
        ) : (
          <div className="grid gap-3">
            {doubts.map((doubt: any) => (
              <div key={doubt.id} className="p-4 bg-white rounded-xl border border-border flex items-center justify-between hover:shadow-sm transition-shadow">
                <div>
                  <h4 className="font-medium text-navy-900">{doubt.title}</h4>
                  <p className="text-xs text-navy-500 mt-1">{new Date(doubt.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  doubt.status === 'RESOLVED' ? 'bg-success-light text-success-dark' : 'bg-navy-100 text-navy-600'
                }`}>
                  {doubt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
