import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
export const metadata: Metadata = {
  title: 'TradeMate — Trade Smart. Trade Direct.',
  description: 'Discover and submit opportunities across ten contract categories, connect with counterparties and agree contracts. Trade Smart. Trade Direct.',
  applicationName: 'TradeMate',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script src="/tm/home-categories.js?v=2" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
