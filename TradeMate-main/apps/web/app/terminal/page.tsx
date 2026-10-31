import { redirect } from 'next/navigation';

// The previous terminal was a parallel marketplace experience with legacy
// product and spot-trading language. Keep one canonical TradeMate app surface.
export default function TerminalPage() {
  redirect('/app');
}
