'use client';
// ─── Reports Catalog Table Component ─────────────────────────────────────────

import React from 'react';
import { FileText } from 'lucide-react';
import type { ReportItem } from '../types/reports.types';

export interface ReportsCatalogTableProps {
  reports:   ReportItem[];
  loading:   boolean;
  onSelect:  (report: ReportItem) => void;
}

export function ReportsCatalogTable({ reports, loading, onSelect }: ReportsCatalogTableProps) {
  if (loading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {reports.map((rep) => (
        <div
          key={rep.id}
          onClick={() => onSelect(rep)}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="truncate flex-1">
            <h4 className="text-xs font-bold text-gray-900 truncate">{rep.title}</h4>
            <span className="text-[10px] text-gray-400 font-medium">{rep.downloadsText}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
