/** Neutral placeholder blocks shown while a page's data loads. Announced once to assistive tech. */
export function Skeleton({ rows = 6, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[1400px] px-6 py-8">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="tk-skel-title mb-6 h-7 w-56 rounded-[8px] bg-[var(--panel)]" />
      <div aria-hidden className="grid gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="tk-skel-row h-14 rounded-[12px] border border-line bg-[linear-gradient(180deg,var(--panel),var(--bg2))]" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  );
}
