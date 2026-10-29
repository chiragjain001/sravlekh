'use client';

import { useState } from 'react';
import { EvaluationDesk } from '../digital-copy/EvaluationDesk';
import { EvaluationWorkspace } from '../digital-copy/EvaluationWorkspace';
import { CreateDigitalAssessmentModal } from '../digital-copy/CreateDigitalAssessmentModal';
import { CreateStructuredAssessmentModal } from '../digital-copy/CreateStructuredAssessmentModal';
import { UploadBookletModal } from '../digital-copy/UploadBookletModal';
import { RecordAttemptPanel } from '../digital-copy/RecordAttemptPanel';
import { DocumentDetailPanel } from '../digital-copy/DocumentDetailPanel';
import {
  useAssessments,
  useAssessment,
  useAssessmentDelivery,
  useCreateDocumentBundle,
  useDocumentsForBundle,
} from '@/hooks/useApi';

export function TeacherDocumentQueue() {
  const [viewMode, setViewMode] = useState<'desk' | 'workspace'>('desk');
  const [activeExamId, setActiveExamId] = useState<string>('exam-1');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStructuredModal, setShowStructuredModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRecordAttempts, setShowRecordAttempts] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const [workspaceMode, setWorkspaceMode] = useState<'student-wise' | 'question-wise'>('student-wise');

  // If in Workspace mode (focus grading canvas matching Image 2)
  if (viewMode === 'workspace') {
    return (
      <EvaluationWorkspace
        examId={activeExamId}
        initialMode={workspaceMode}
        onExit={() => setViewMode('desk')}
      />
    );
  }

  // Default: Evaluation Desk matching Image 1
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <EvaluationDesk
        onOpenWorkspace={(examId, mode) => {
          setActiveExamId(examId);
          if (mode) setWorkspaceMode(mode);
          setViewMode('workspace');
        }}
      />

      {/* Sub-modals if triggered */}
      {showCreateModal && (
        <CreateDigitalAssessmentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false);
            setActiveExamId(id);
            setViewMode('workspace');
          }}
        />
      )}

      {showStructuredModal && (
        <CreateStructuredAssessmentModal
          onClose={() => setShowStructuredModal(false)}
          onCreated={() => setShowStructuredModal(false)}
        />
      )}
    </div>
  );
}
