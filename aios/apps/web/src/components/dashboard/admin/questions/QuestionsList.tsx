'use client';

import { useState } from 'react';
import { useQuestions } from '@/hooks/useApi';
import { Plus, Search, Filter } from 'lucide-react';
import { CreateQuestionModal } from './CreateQuestionModal';

export function QuestionsList() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: questionsData, isLoading } = useQuestions({
    search: search || undefined,
    type: type || undefined,
    difficulty: difficulty || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Question Bank</h2>
          <p className="text-sm text-navy-500">Manage questions for exams and practice tests.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search questions..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative sm:w-48">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <select
            className="input pl-10 appearance-none bg-transparent"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="MCQ">MCQ</option>
            <option value="MULTI_CORRECT">Multi-Correct</option>
            <option value="SHORT_ANSWER">Short Answer</option>
            <option value="LONG_ANSWER">Long Answer</option>
            <option value="NUMERICAL">Numerical</option>
          </select>
        </div>
        <div className="relative sm:w-48">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <select
            className="input pl-10 appearance-none bg-transparent"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-navy-500">Loading questions...</div>
        ) : questionsData?.data?.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-navy-900 font-medium mb-1">No questions found.</p>
            <p className="text-navy-500 text-sm">Add questions to build your bank.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-navy-50 text-navy-700 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Question Preview</th>
                  <th className="px-6 py-4 font-medium">Topic</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Difficulty</th>
                  <th className="px-6 py-4 font-medium">Marks</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {questionsData?.data.map((q: any) => (
                  <tr key={q.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900 truncate max-w-xs" title={q.content}>
                        {q.content.length > 50 ? `${q.content.substring(0, 50)}...` : q.content}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-navy-700">{q.topic?.name || '—'}</td>
                    <td className="px-6 py-4 text-navy-700 text-xs font-semibold tracking-wide">
                      {q.type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`chip-${q.difficulty === 'EASY' ? 'success' : q.difficulty === 'MEDIUM' ? 'warning' : 'error'}`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-navy-700">{q.marks} ({q.negativeMarks})</td>
                    <td className="px-6 py-4">
                      <span className={q.isApproved ? 'chip-success' : 'chip-navy'}>
                        {q.isApproved ? 'Approved' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-teal-600 hover:text-teal-800 font-medium text-xs">
                        View/Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateQuestionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
