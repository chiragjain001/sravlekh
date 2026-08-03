'use client';

import { useBatchHeatmap } from '@/hooks/useApi';
import { AlertTriangle, CheckCircle, Flame, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export function BatchHeatmap({ batchId }: { batchId: string }) {
  const { data: heatmapData, isLoading } = useBatchHeatmap(batchId);

  const handleAutoRemedial = (topicId: string, topicName: string) => {
    // In a real implementation, this would trigger the Python /assignments/auto-trigger endpoint
    toast.success(`Auto-remedial assignment triggered for ${topicName}!`);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-navy-500 animate-pulse">Analyzing class performance...</div>;
  }

  const data = heatmapData?.data;

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-border rounded-lg bg-navy-50">
        <Flame className="w-8 h-8 text-navy-300 mx-auto mb-2" />
        <p className="text-navy-900 font-medium">No Data Available</p>
        <p className="text-navy-500 text-sm">Students need to complete exams to generate the heatmap.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
          <Flame className="w-5 h-5 text-warning" />
          Struggle Heatmap
        </h3>
        <span className="text-xs text-navy-500">Sorted by lowest mastery</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((topic: any) => {
          const isCritical = topic.status === 'CRITICAL';
          const isWarning = topic.status === 'WARNING';
          
          return (
            <div 
              key={topic.topicId} 
              className={`p-4 rounded-lg border-l-4 shadow-sm bg-white ${
                isCritical ? 'border-l-error' : isWarning ? 'border-l-warning' : 'border-l-success'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-navy-900 truncate" title={topic.topicName}>
                  {topic.topicName}
                </h4>
                {isCritical ? (
                  <AlertTriangle className="w-4 h-4 text-error" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-success" />
                )}
              </div>
              
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-navy-900">{topic.averageMastery}%</p>
                  <p className="text-xs text-navy-500">Avg. Mastery</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${isCritical ? 'text-error' : 'text-navy-700'}`}>
                    {topic.studentsStruggling} / {topic.totalStudents}
                  </p>
                  <p className="text-xs text-navy-500">Struggling</p>
                </div>
              </div>

              {(isCritical || isWarning) && (
                <button 
                  onClick={() => handleAutoRemedial(topic.topicId, topic.topicName)}
                  className="w-full btn-secondary text-xs py-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center justify-center gap-1"
                >
                  <Zap className="w-3 h-3 text-warning" />
                  Auto-Generate Remedial
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}
