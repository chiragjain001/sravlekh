import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { BatchesList } from '@/components/dashboard/admin/batches/BatchesList';

export const metadata: Metadata = {
  title: 'Batches | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <BatchesList />
    </AdminDashboardLayout>
  );
}
