// app/layout.tsx (or src/app/layout.tsx)
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Driving School ESystem',
  description: 'Payment and Lesson Management for Driving Schools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
