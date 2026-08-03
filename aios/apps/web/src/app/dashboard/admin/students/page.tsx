import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { StudentsList } from '@/components/dashboard/admin/students/StudentsList';

export const metadata: Metadata = {
  title: 'Students | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <StudentsList />
    </AdminDashboardLayout>
  );
}
