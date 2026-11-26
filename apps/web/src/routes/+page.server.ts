import type { PageServerLoad } from './$types';

// Spike Q2: a real server load (the app runs on adapter-vercel, not prerendered). `scenario` is
// rendered into the server HTML by a shared component. `streamed` is a top-level promise, so Kit
// streams it after the first flush; it carries a Date because devalue's handling of exactly that
// broke the streamed path once already (see the spike note, Q1 "Kit runtime dependencies").
export const load: PageServerLoad = () => ({
  scenario: { name: 'Server scenario', startingBalance: 250_000, source: 'the server load' },
  streamed: new Promise<{ when: Date; label: string }>((resolve) => {
    setTimeout(() => resolve({ when: new Date(Date.UTC(2026, 0, 1)), label: 'streamed-ok' }), 300);
  })
});
