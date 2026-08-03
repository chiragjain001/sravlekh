'use client';

import { useState } from 'react';
import { useTeachers } from '@/hooks/useApi';
import { Plus, Search } from 'lucide-react';
import { CreateTeacherModal } from './CreateTeacherModal';

export function TeachersList() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: teachersData, isLoading } = useTeachers({
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Teachers</h2>
          <p className="text-sm text-navy-500">Manage teaching staff and their batch assignments.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Teacher
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-navy-500">Loading teachers...</div>
        ) : teachersData?.data?.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-navy-900 font-medium mb-1">No teachers found.</p>
            <p className="text-navy-500 text-sm">Add your first teacher to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-navy-50 text-navy-700 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Teacher</th>
                  <th className="px-6 py-4 font-medium">Qualification</th>
                  <th className="px-6 py-4 font-medium">Active Batches</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teachersData?.data.map((teacher: any) => (
                  <tr key={teacher.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900">{teacher.user.name}</div>
                      <div className="text-navy-500 text-xs">{teacher.user.email}</div>
                    </td>
                    <td className="px-6 py-4 text-navy-700">{teacher.qualification || '—'}</td>
                    <td className="px-6 py-4 text-navy-700">
                      <span className="chip-navy">{teacher.batchAssignments?.length || 0} Batches</span>
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

      <CreateTeacherModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
