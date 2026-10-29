import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'TradeMate — Trade Smart. Trade Direct.',
  description: 'Discover products, services, and the people moving business forward. Trade Smart. Trade Direct.',
  applicationName: 'TradeMate',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
