export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Initials avatar; the full name is always available on hover. */
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="font-label inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-panel2 text-[9px] font-bold text-ink"
      style={{ width: size, height: size }}
      data-tip={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
