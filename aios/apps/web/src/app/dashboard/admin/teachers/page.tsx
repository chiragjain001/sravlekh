import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { TeachersList } from '@/components/dashboard/admin/teachers/TeachersList';

export const metadata: Metadata = {
  title: 'Teachers | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <TeachersList />
    </AdminDashboardLayout>
  );
}
