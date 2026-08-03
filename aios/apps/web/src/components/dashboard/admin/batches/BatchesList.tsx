'use client';

import { useState } from 'react';
import { useBatches } from '@/hooks/useApi';
import { Plus } from 'lucide-react';
import { CreateBatchModal } from './CreateBatchModal';

export function BatchesList() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: batches, isLoading } = useBatches();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Batches</h2>
          <p className="text-sm text-navy-500">Manage classes, sections, and study groups.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Create Batch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-navy-500">Loading batches...</div>
        ) : batches?.length === 0 ? (
          <div className="col-span-full card p-12 text-center">
            <p className="text-navy-900 font-medium mb-1">No batches found.</p>
            <p className="text-navy-500 text-sm">Create your first batch to start enrolling students.</p>
          </div>
        ) : (
          batches?.map((batch: any) => (
            <div key={batch.id} className="card-action">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-navy-900 text-lg">{batch.name}</h3>
                <span className={batch.isActive ? 'chip-success' : 'chip-navy'}>
                  {batch.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm">
                  <span className="text-navy-500 w-24">Class/Year:</span>
                  <span className="font-medium text-navy-900">{batch.classYear || '—'}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-navy-500 w-24">Academic Yr:</span>
                  <span className="font-medium text-navy-900">{batch.academicYear || '—'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-4 text-sm text-navy-600">
                  <div className="flex flex-col">
                    <span className="font-semibold text-navy-900">{batch._count?.students || 0}</span>
                    <span className="text-xs">Students</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-navy-900">{batch._count?.teachers || 0}</span>
                    <span className="text-xs">Teachers</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateBatchModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
