'use strict';

// Equal-jitter exponential backoff. A successful handshake must not reset this
// policy; callers reset only after the connection has demonstrated stability.
function createReconnectPolicy(options = {}) {
  const baseDelayMs = Number.isFinite(options.baseDelayMs) && options.baseDelayMs > 0 ? options.baseDelayMs : 1000;
  const maxDelayMs = Number.isFinite(options.maxDelayMs) && options.maxDelayMs >= baseDelayMs ? options.maxDelayMs : 30000;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  let attempt = 0;

  return {
    nextDelay() {
      const ceiling = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt));
      attempt += 1;
      const sample = Math.max(0, Math.min(1, Number(random()) || 0));
      return Math.min(maxDelayMs, Math.floor(ceiling / 2 + sample * ceiling / 2));
    },
    reset() { attempt = 0; },
    get attempt() { return attempt; },
  };
}

module.exports = { createReconnectPolicy };
