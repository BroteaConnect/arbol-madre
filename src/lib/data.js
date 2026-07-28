import { SEED_PROJECTS } from './seed.js';

export const API_URL = 'https://api.brotea.dev/garden';
const POLL_MS = 15_000;

// Events the tree animates as sap pulses; deploys additionally bloom.
export const BLOOM_EVENTS = new Set(['deployment.completed']);

// Polls the factory API. Callbacks:
//   onSnapshot(projects, live)  — full project list; live=false means seed data
//   onEvents(events)            — only events not seen before, oldest first
export function startPolling({ onSnapshot, onEvents }) {
  let lastEventId = null;
  let usingSeed = false;

  async function tick(first) {
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onSnapshot(data.projects, true);
      const events = (data.events ?? []).slice().reverse(); // oldest first
      if (first) {
        // Replay the tail so the tree never starts still.
        onEvents(events.slice(-8));
      } else if (lastEventId != null) {
        onEvents(events.filter((e) => e.id > lastEventId));
      }
      if (events.length) lastEventId = events[events.length - 1].id;
      usingSeed = false;
    } catch {
      if (first || !usingSeed) {
        usingSeed = true;
        onSnapshot(SEED_PROJECTS, false);
      }
    }
  }

  tick(true);
  const timer = setInterval(() => tick(false), POLL_MS);
  return () => clearInterval(timer);
}
