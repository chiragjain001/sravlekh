'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

export function ExamsList() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Exams</h2>
          <p className="text-sm text-navy-500">Schedule tests, link papers, and grade answer sheets.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Schedule Exam
        </button>
      </div>

      <div className="card min-h-[400px] flex flex-col items-center justify-center border-dashed border-2 border-border bg-navy-50">
        <p className="text-navy-900 font-medium mb-1">No upcoming exams.</p>
        <p className="text-navy-500 text-sm">Schedule an exam for a batch to get started.</p>
        <button onClick={() => setIsModalOpen(true)} className="btn-secondary mt-4">
          Schedule Exam
        </button>
      </div>
      
      {/* Create Exam Modal will go here */}
    </div>
  );
}
