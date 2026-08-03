import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { DoubtsList } from '@/components/dashboard/admin/doubts/DoubtsList';

export const metadata: Metadata = {
  title: 'Doubts | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <DoubtsList />
    </AdminDashboardLayout>
  );
}
