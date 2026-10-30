export default function TradeMateAppRoute() {
  return (
    <main style={{ position: 'fixed', inset: 0, width: '100%', height: '100dvh', minHeight: '100vh', overflow: 'hidden', background: '#05070a' }}>
      <iframe
        title="TradeMate trading workspace"
        src="/tm/app-shell.html"
        allow="camera; microphone; clipboard-read; clipboard-write"
        referrerPolicy="same-origin"
        style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#05070a' }}
      />
    </main>
  );
}
