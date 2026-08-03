import type { Metadata } from 'next';
import { AdminDashboardLayout } from '@/components/dashboard/admin/AdminDashboardLayout';
import { TimetableList } from '@/components/dashboard/admin/timetable/TimetableList';

export const metadata: Metadata = {
  title: 'Timetable | Admin',
};

export default function Page() {
  return (
    <AdminDashboardLayout>
      <TimetableList />
    </AdminDashboardLayout>
  );
}
