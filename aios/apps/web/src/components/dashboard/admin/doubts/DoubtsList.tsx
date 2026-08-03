'use client';

import { useState } from 'react';
import { useDoubts } from '@/hooks/useApi';
import { Search, Filter, MessageSquare } from 'lucide-react';

export function DoubtsList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  
  const { data: doubtsData, isLoading } = useDoubts({
    status: status || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Doubt Resolution</h2>
          <p className="text-sm text-navy-500">Manage and assign student doubts to teachers.</p>
        </div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search doubts..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative sm:w-48">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <select
            className="input pl-10 appearance-none bg-transparent"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ANSWERED">Answered</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-navy-500">Loading doubts...</div>
        ) : doubtsData?.data?.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-navy-300 mx-auto mb-3" />
            <p className="text-navy-900 font-medium mb-1">No doubt tickets found.</p>
            <p className="text-navy-500 text-sm">Students haven't raised any doubts yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-navy-50 text-navy-700 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Student</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Preview</th>
                  <th className="px-6 py-4 font-medium">Urgency</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {doubtsData?.data.map((doubt: any) => (
                  <tr key={doubt.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-navy-900">
                      {doubt.studentProfile?.user?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-navy-700">{doubt.subject?.name || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="text-navy-700 truncate max-w-[200px]" title={doubt.content}>
                        {doubt.content}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`chip-${doubt.urgency === 3 ? 'error' : doubt.urgency === 2 ? 'warning' : 'navy'}`}>
                        {doubt.urgency === 3 ? 'High' : doubt.urgency === 2 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`chip-${
                        doubt.status === 'OPEN' ? 'error' : 
                        doubt.status === 'ANSWERED' ? 'success' : 
                        doubt.status === 'ASSIGNED' ? 'warning' : 'navy'
                      }`}>
                        {doubt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-navy-700">
                      {new Date(doubt.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-teal-600 hover:text-teal-800 font-medium text-xs">
                        View / Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
