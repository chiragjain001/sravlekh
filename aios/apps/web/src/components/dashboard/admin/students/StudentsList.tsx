'use client';

import { useState } from 'react';
import { useStudents, useBatches } from '@/hooks/useApi';
import { Plus, Search, Filter } from 'lucide-react';
import { CreateStudentModal } from './CreateStudentModal';

export function StudentsList() {
  const [search, setSearch] = useState('');
  const [batchId, setBatchId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use debounced search in a real app; simplified for brevity here
  const { data: studentsData, isLoading: isLoadingStudents } = useStudents({
    search: search || undefined,
    batchId: batchId || undefined,
  });
  
  const { data: batchesData } = useBatches();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Students</h2>
          <p className="text-sm text-navy-500">Manage all student profiles across the institute.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Enrol Student
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search by name, email, or roll number..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative sm:w-64">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <select
            className="input pl-10 appearance-none bg-transparent"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            <option value="">All Batches</option>
            {batchesData?.map((batch: any) => (
              <option key={batch.id} value={batch.id}>{batch.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoadingStudents ? (
          <div className="p-8 text-center text-navy-500">Loading students...</div>
        ) : studentsData?.data?.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-navy-900 font-medium mb-1">No students found.</p>
            <p className="text-navy-500 text-sm">Try adjusting your filters or enrol a new student.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-navy-50 text-navy-700 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Student Name</th>
                  <th className="px-6 py-4 font-medium">Roll No.</th>
                  <th className="px-6 py-4 font-medium">Batch</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {studentsData?.data.map((student: any) => (
                  <tr key={student.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900">{student.user.name}</div>
                      <div className="text-navy-500 text-xs">{student.user.email}</div>
                    </td>
                    <td className="px-6 py-4 text-navy-700">{student.rollNumber || '—'}</td>
                    <td className="px-6 py-4 text-navy-700">
                      {student.batch?.name ? (
                        <span className="chip-navy">{student.batch.name}</span>
                      ) : (
                        <span className="text-navy-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={student.user.status === 'ACTIVE' ? 'chip-success' : 'chip-error'}>
                        {student.user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-teal-600 hover:text-teal-800 font-medium text-xs">
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateStudentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        batches={batchesData ?? []}
      />
    </div>
  );
}
