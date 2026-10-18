/** Labelled empty state: what would appear here, and who can add it. */
export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-line-strong px-6 py-8 text-center">
      <p className="font-display text-[18px] font-light text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-muted">{hint}</p>
    </div>
  );
}
