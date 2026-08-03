import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Home' };

/** Root redirect — send authenticated users to /login which handles role routing. */
export default function Page() {
  return (
    <meta
      httpEquiv="refresh"
      content="0; url=/login"
    />
  );
}
