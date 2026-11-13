'use strict';

function buildReadiness({ feedStatus, feedLastMessage, books, now = Date.now(), feedIdleMs, staleMs, fxStatus }) {
  const feeds = Object.fromEntries([...feedStatus].map(([name, connected]) => {
    const lastMessageAt = feedLastMessage.get(name) || null;
    const ageMs = lastMessageAt == null ? null : Math.max(0, now - lastMessageAt);
    return [name, {
      live: Boolean(connected && ageMs != null && ageMs <= feedIdleMs),
      lastMessageAgeMs: ageMs,
    }];
  }));
  const liveFeeds = Object.values(feeds).filter((feed) => feed.live).length;
  const observedBooks = books.filter((book) => Number.isFinite(book.ts) && book.ts > 0);
  const staleBooks = observedBooks.filter((book) => now - book.ts > staleMs).length;
  const freshBooks = observedBooks.length - staleBooks;
  const ready = liveFeeds > 0 && freshBooks > 0;
  const fxUpdatedAt = fxStatus && fxStatus.updatedAt ? Date.parse(fxStatus.updatedAt) : NaN;
  const fxAgeMs = Number.isFinite(fxUpdatedAt) ? Math.max(0, now - fxUpdatedAt) : null;

  return {
    ready,
    status: ready && liveFeeds === feedStatus.size ? 'ready' : 'degraded',
    feeds: { live: liveFeeds, total: feedStatus.size, providers: feeds },
    books: { observed: observedBooks.length, fresh: freshBooks, stale: staleBooks },
    fx: {
      state: fxStatus && fxStatus.state ? fxStatus.state : 'not_configured',
      quoteCount: fxStatus && Number.isFinite(fxStatus.quoteCount) ? fxStatus.quoteCount : 0,
      lastUpdateAgeMs: fxAgeMs,
    },
    checkedAt: new Date(now).toISOString(),
  };
}

module.exports = { buildReadiness };
