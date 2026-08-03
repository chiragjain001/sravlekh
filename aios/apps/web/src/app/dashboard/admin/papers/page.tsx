import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { PapersList } from '@/components/dashboard/admin/papers/PapersList';

export const metadata: Metadata = {
  title: 'Papers Engine | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <PapersList />
    </AdminDashboardLayout>
  );
}
