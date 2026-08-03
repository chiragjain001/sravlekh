import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { QuestionsList } from '@/components/dashboard/admin/questions/QuestionsList';

export const metadata: Metadata = {
  title: 'Question Bank | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <QuestionsList />
    </AdminDashboardLayout>
  );
}
