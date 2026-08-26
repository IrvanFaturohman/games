// Namespaced localStorage. Private browsing and "block site data" both make
// the accessor itself throw, so every call is guarded — a game must still run
// when nothing can be saved.

export function createStore(namespace) {
  const key = (k) => `${namespace}:${k}`;

  return {
    get(k, fallback = null) {
      try {
        const raw = localStorage.getItem(key(k));
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(k, value) {
      try { localStorage.setItem(key(k), JSON.stringify(value)); return true; }
      catch { return false; }
    },
    // Convenience for the one thing every game here needs.
    bestScore(score) {
      const best = this.get('best', 0);
      if (score > best) { this.set('best', score); return score; }
      return best;
    },
  };
}
