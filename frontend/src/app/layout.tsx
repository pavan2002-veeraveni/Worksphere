import type { Metadata } from 'next';
import { Providers } from '@/components/layout/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkSphere — Multi-Tenant Project & Workflow Automation Platform',
  description:
    'Plan projects, assign work, automate workflows, track delivery, and analyze team performance across organizations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
