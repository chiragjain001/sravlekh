import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: {
    template: '%s | AIOS',
    default: 'AIOS — Academic Intelligence Operating System',
  },
  description:
    'Academic Intelligence Platform for coaching institutes and schools. Turn every test into an improvement plan.',
  robots: { index: false }, // Internal tool — not for public indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '14px',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
