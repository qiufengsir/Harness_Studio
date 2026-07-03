import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { I18nProvider } from '@/components/i18n/I18nProvider';

export const metadata: Metadata = {
  title: 'Harness Studio — AI Workflow Orchestrator',
  description: 'Reverse-engineer AI configs from your code, orchestrate multi-agent loops, and measure AI code quality.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
