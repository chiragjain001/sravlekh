import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { ExamsList } from '@/components/dashboard/admin/exams/ExamsList';

export const metadata: Metadata = {
  title: 'Exams | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <ExamsList />
    </AdminDashboardLayout>
  );
}
