import { Chip, type ChipTone } from "./chip";

/** Legend row: every chip/marker on a screen is explained here. */
export function Legend({ items }: { items: { tone: ChipTone; label: string; meaning: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Legend">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-[12px] text-muted">
          <Chip tone={it.tone} label={it.label} />
          <span>{it.meaning}</span>
        </li>
      ))}
    </ul>
  );
}
