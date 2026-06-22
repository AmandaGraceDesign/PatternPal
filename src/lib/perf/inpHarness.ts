// Dev-only INP logger. Logs each interaction's latency to the console so we can
// confirm worst-case gestures (zoom-drag, pan, dimension change) stay <200ms
// under CPU throttle, before trusting Production Speed Insights' multi-day lag.
export function startInpHarness() {
  if (process.env.NODE_ENV !== 'development') return;
  import('web-vitals/attribution')
    .then(({ onINP }) => {
      onINP(
        (metric) => {
          const target = (metric.attribution as { interactionTarget?: string } | undefined)?.interactionTarget;
          console.log(`[INP] ${Math.round(metric.value)}ms (${metric.rating})`, target ?? '');
        },
        { reportAllChanges: true },
      );
    })
    .catch(() => {
      // web-vitals is a dev-only dependency; ignore if unavailable in prod builds
    });
}
