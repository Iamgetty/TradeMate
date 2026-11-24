'use strict';

function createLifecycle() {
  let stopped = false;
  const sockets = new Set();
  const timers = new Map();

  function trackSocket(socket) {
    if (!socket) return () => {};
    if (stopped) {
      try { socket.terminate?.(); } catch (_) {}
      return () => {};
    }
    sockets.add(socket);
    return () => sockets.delete(socket);
  }

  function trackTimer(timer, clear = clearTimeout) {
    if (timer == null) return () => {};
    if (stopped) {
      clear(timer);
      return () => {};
    }
    timers.set(timer, clear);
    return () => timers.delete(timer);
  }

  function stop() {
    if (stopped) return false;
    stopped = true;
    for (const [timer, clear] of timers) {
      try { clear(timer); } catch (_) {}
    }
    timers.clear();
    for (const socket of sockets) {
      try {
        if (socket.readyState === 0 || socket.readyState === 1) {
          socket.close(1001, 'Feed service shutting down');
        }
      } catch (_) {
        try { socket.terminate?.(); } catch (_) {}
      }
    }
    sockets.clear();
    return true;
  }

  return {
    trackSocket,
    trackTimer,
    stop,
    get stopped() { return stopped; },
    get socketCount() { return sockets.size; },
    get timerCount() { return timers.size; },
  };
}

module.exports = { createLifecycle };
