import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Home' };

/** Root redirect — send authenticated users to /login which handles role routing. */
export default function Page() {
  redirect('/login');
}

