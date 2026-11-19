'use strict';

(function attachMarketMetadata(root) {
  function createMarketMetadataRefresher(options = {}) {
    const request = options.fetch || root.fetch;
    const now = options.now || Date.now;
    const onStatus = options.onStatus || function () {};
    let inFlight = null;
    let status = {
      state: 'unavailable',
      lastAttemptAt: null,
      lastSuccessAt: null,
      error: null,
    };

    function publish(next) {
      status = Object.assign({}, status, next);
      onStatus(Object.assign({}, status));
    }

    function refresh({ url, apply, isCurrent = () => true } = {}) {
      if (inFlight) return inFlight;
      if (typeof request !== 'function' || typeof url !== 'string' || !url || typeof apply !== 'function') {
        return Promise.resolve({ state: status.state, skipped: true });
      }

      publish({ state: status.lastSuccessAt ? 'stale' : 'unavailable', lastAttemptAt: now(), error: null });
      const pending = Promise.resolve()
        .then(() => request(url))
        .then((response) => {
          if (!response || !response.ok) throw new Error('Market metadata request failed');
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error('Market metadata response was not an array');
          if (!isCurrent()) {
            publish({ state: status.lastSuccessAt ? 'stale' : 'unavailable' });
            return { state: status.state, ignored: true };
          }
          apply(data);
          publish({ state: 'fresh', lastSuccessAt: now(), error: null });
          return { state: 'fresh', count: data.length };
        })
        .catch((error) => {
          publish({
            state: status.lastSuccessAt ? 'stale' : 'unavailable',
            error: error && error.message ? error.message : 'Market metadata request failed',
          });
          return { state: status.state, error: status.error };
        })
        .finally(() => {
          if (inFlight === pending) inFlight = null;
        });

      inFlight = pending;
      return pending;
    }

    return {
      refresh,
      getStatus() { return Object.assign({}, status); },
    };
  }

  root.createMarketMetadataRefresher = createMarketMetadataRefresher;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createMarketMetadataRefresher };
  }
})(typeof window !== 'undefined' ? window : globalThis);
