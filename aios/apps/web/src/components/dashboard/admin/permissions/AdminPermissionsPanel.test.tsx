import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminPermissionsPanel } from './AdminPermissionsPanel';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTemplates = [
  {
    id: 'tpl_principal',
    name: 'Principal / Head of Institute',
    slug: 'principal',
    description: 'Executive oversight over academic quality and staff',
    baseRole: 'ADMIN',
    isSystem: true,
    permissions: ['timetable:view', 'question:approve', 'audit:view'],
    defaultScope: 'INSTITUTE',
    userCount: 1,
  },
  {
    id: 'tpl_senior_evaluator',
    name: 'Senior Teacher / Reviewer',
    slug: 'senior_evaluator',
    description: 'Authorized to review AI evaluations and override marks',
    baseRole: 'TEACHER',
    isSystem: true,
    permissions: ['REVIEW_EVALUATION', 'evaluation:grade'],
    defaultScope: 'BATCH',
    userCount: 2,
  },
];

const mockCanonical = [
  {
    key: 'REVIEW_EVALUATION',
    label: 'Review & Override Evaluation',
    description: 'Senior reviewer authority to override marks',
    category: 'evaluations',
    risk: 'critical',
    supportedScopes: ['INSTITUTE', 'BATCH', 'SUBJECT'],
  },
  {
    key: 'timetable:view',
    label: 'View Timetable Schedules',
    description: 'View master timetable schedules',
    category: 'academics',
    risk: 'standard',
    supportedScopes: ['INSTITUTE'],
  },
];

const mockCategories = [
  { id: 'academics', label: 'Academics & Batches', description: 'Curriculum & timetable', icon: 'Layers' },
  { id: 'evaluations', label: 'Evaluations & Grading', description: 'Grading answer sheets', icon: 'Star' },
];

const mockGrants = [
  {
    id: 'grant-1',
    userId: 'u-1',
    permission: 'REVIEW_EVALUATION',
    batchId: null,
    subjectId: null,
    createdAt: '2026-10-09T10:00:00Z',
    user: { id: 'u-1', name: 'Dr. Neha Malhotra', email: 'neha@inst.com', role: 'ADMIN' },
  },
];

const mockTeachers = [
  { id: 't-1', user: { id: 'u-1', name: 'Dr. Neha Malhotra', email: 'neha@inst.com', role: 'ADMIN' } },
  { id: 't-2', user: { id: 'u-2', name: 'Rohan Sharma', email: 'rohan@inst.com', role: 'TEACHER' } },
];

vi.mock('@/hooks/useApi', () => ({
  useRolesAndPermissions: () => ({
    data: {
      templates: mockTemplates,
      canonicalPermissions: mockCanonical,
      categories: mockCategories,
    },
    isLoading: false,
  }),
  usePermissionGrants: () => ({
    data: mockGrants,
    isLoading: false,
  }),
  useTeachers: () => ({
    data: { data: mockTeachers },
    isLoading: false,
  }),
  useBatches: () => ({
    data: [{ id: 'b-1', name: 'Class 10-A' }],
    isLoading: false,
  }),
  useSubjects: () => ({
    data: [{ id: 's-1', name: 'Mathematics' }],
    isLoading: false,
  }),
  useCreatePermissionGrant: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateBulkPermissionGrants: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSyncUserPermissions: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokePermissionGrant: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRevokeBulkGrants: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateCustomRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCustomRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCustomRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDuplicateRole: () => ({ mutate: vi.fn(), isPending: false }),
  useAssignRoleToUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSimulateAccess: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      totalGrantedCount: 2,
      accessibleModules: ['Evaluation Queue', 'Batches & Timetable'],
      activePermissions: mockCanonical,
      sensitiveFlags: [
        {
          permission: 'REVIEW_EVALUATION',
          label: 'Review & Override Evaluation',
          risk: 'critical',
          warning: 'Can override teacher-evaluated marks and dispute scores',
        },
      ],
      scope: { batchId: 'INSTITUTE_WIDE', subjectId: 'ALL_SUBJECTS' },
    }),
    isPending: false,
  }),
  usePermissionAuditTrail: () => ({
    data: [
      {
        id: 'log-1',
        action: 'CREATE',
        entity: 'user_permission_grants',
        entityId: 'grant-1',
        actorName: 'Admin Neha',
        actorEmail: 'neha@inst.com',
        newValue: { permission: 'REVIEW_EVALUATION' },
        createdAt: '2026-10-09T10:00:00Z',
      },
    ],
    isLoading: false,
  }),
}));

describe('AdminPermissionsPanel', () => {
  it('renders KPI header cards and tab navigation bar', () => {
    render(<AdminPermissionsPanel />);

    expect(screen.getByText('Roles & Templates')).toBeInTheDocument();
    expect(screen.getAllByText('Active Grants').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Protected Operations')).toBeInTheDocument();
    expect(screen.getByText('Tenant Security')).toBeInTheDocument();

    expect(screen.getByText('Role Templates')).toBeInTheDocument();
    expect(screen.getByText('Permission Matrix')).toBeInTheDocument();
    expect(screen.getByText('Access Simulator')).toBeInTheDocument();
    expect(screen.getByText('Security Audit Trail')).toBeInTheDocument();
  });

  it('renders role templates view by default', () => {
    render(<AdminPermissionsPanel />);

    expect(screen.getByText('Principal / Head of Institute')).toBeInTheDocument();
    expect(screen.getByText('Senior Teacher / Reviewer')).toBeInTheDocument();
    expect(screen.getByText('Create Custom Role')).toBeInTheDocument();
  });

  it('navigates to Active Grants directory tab', () => {
    render(<AdminPermissionsPanel />);

    const grantsTab = screen.getByRole('button', { name: /Active Grants/i });
    fireEvent.click(grantsTab);

    expect(screen.getByText(/Showing 1 grants/i)).toBeInTheDocument();
    expect(screen.getByText('Dr. Neha Malhotra')).toBeInTheDocument();
    expect(screen.getByText('REVIEW_EVALUATION')).toBeInTheDocument();
  });

  it('navigates to Security Audit Trail tab', () => {
    render(<AdminPermissionsPanel />);

    const auditTab = screen.getByRole('button', { name: /Security Audit Trail/i });
    fireEvent.click(auditTab);

    expect(screen.getByText(/1 audit events logged/i)).toBeInTheDocument();
    expect(screen.getByText('user_permission_grants')).toBeInTheDocument();
    expect(screen.getByText('Admin Neha')).toBeInTheDocument();
  });

  it('navigates to Access Simulator tab', () => {
    render(<AdminPermissionsPanel />);

    const simTab = screen.getByRole('button', { name: /Access Simulator/i });
    fireEvent.click(simTab);

    expect(screen.getByText('Access Policy Simulation & Impact Analysis')).toBeInTheDocument();
    expect(screen.getByText('Run Server-Side Policy Simulation')).toBeInTheDocument();
  });
});
