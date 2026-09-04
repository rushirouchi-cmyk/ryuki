import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'INFRALINK Talent Intelligence',
  description: 'インフラリンク株式会社 AI人材紹介オペレーションシステム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
