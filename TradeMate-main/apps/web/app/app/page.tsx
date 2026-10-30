import { redirect } from 'next/navigation';

export default function TradeMateAppRoute() {
  // Use the original standalone TradeMate entry point. It owns the legacy
  // app shell, API configuration, and script order in one place.
  redirect('/tm/index.html');
}
