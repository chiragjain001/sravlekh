'use client';

import { useState } from 'react';
import { useBlueprints, useGeneratePaper } from '@/hooks/useApi';
import { Plus, Play, Search } from 'lucide-react';
import { CreateBlueprintModal } from './CreateBlueprintModal';
import { GeneratePaperModal } from './GeneratePaperModal';

export function PapersList() {
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<any>(null);

  const { data: blueprints, isPending } = useBlueprints();

  const handleGenerateClick = (blueprint: any) => {
    setSelectedBlueprint(blueprint);
    setIsGenerateModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Papers Engine</h2>
          <p className="text-sm text-navy-500">Manage syllabus blueprints and generate exam papers.</p>
        </div>
        <button
          onClick={() => setIsBlueprintModalOpen(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Create Blueprint
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {isPending ? (
          <div className="p-8 text-center text-navy-500">Loading blueprints...</div>
        ) : blueprints?.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-navy-900 font-medium mb-1">No blueprints found.</p>
            <p className="text-navy-500 text-sm">Create a blueprint to start generating papers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-navy-50 text-navy-700 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Blueprint Name</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Total Marks</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {blueprints?.map((bp: any) => (
                  <tr key={bp.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-navy-900">{bp.name}</div>
                    </td>
                    <td className="px-6 py-4 text-navy-700">{bp.subject?.name || '—'}</td>
                    <td className="px-6 py-4 text-navy-700">{bp.totalMarks}</td>
                    <td className="px-6 py-4 text-navy-700">{bp.duration} mins</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleGenerateClick(bp)}
                        className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 text-teal-600" />
                        Generate Paper
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateBlueprintModal 
        isOpen={isBlueprintModalOpen} 
        onClose={() => setIsBlueprintModalOpen(false)} 
      />

      {selectedBlueprint && (
        <GeneratePaperModal 
          isOpen={isGenerateModalOpen} 
          onClose={() => setIsGenerateModalOpen(false)} 
          blueprint={selectedBlueprint}
        />
      )}
    </div>
  );
}
