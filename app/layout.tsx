import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Quotation Document Generator | Enterprise DOCX & PDF Studio',
  description:
    'Eliminate manual quotation document preparation. Dynamic template inspection, run-split normalization, live preview, and high-fidelity DOCX & PDF generation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased text-slate-900 bg-slate-50">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
