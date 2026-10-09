import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ProvedorSessao } from '@/lib/sessao';

export const metadata: Metadata = {
  title: 'Carteira CAC — Backoffice',
  description: 'Administração do Carteira CAC',
  icons: { icon: '/logo.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ProvedorSessao>{children}</ProvedorSessao>
      </body>
    </html>
  );
}
