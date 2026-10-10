import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginPage } from '@/components/auth/LoginPage';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to AIOS Academic Intelligence Operating System.',
  alternates: {
    canonical: '/login',
  },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}

