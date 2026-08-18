import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { AcademicsList } from '@/components/dashboard/admin/academics/AcademicsList';

export const metadata: Metadata = {
  title: 'Academics | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <AcademicsList />
    </AdminDashboardLayout>
  );
}
