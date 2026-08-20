import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

export const metadata: Metadata = {
  title: 'Content Plan - PT Wijaya Inovasi Gemilang',
  description: 'Enterprise Social Media Management & Planning Platform by PT Wijaya Inovasi Gemilang.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="bg-[#f8fafc] text-slate-800 min-h-screen antialiased selection:bg-slate-900 selection:text-white">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
