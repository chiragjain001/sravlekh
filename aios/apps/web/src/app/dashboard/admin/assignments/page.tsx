import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { AssignmentsList } from '@/components/dashboard/admin/assignments/AssignmentsList';

export const metadata: Metadata = {
  title: 'Assignments | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <AssignmentsList />
    </AdminDashboardLayout>
  );
}
