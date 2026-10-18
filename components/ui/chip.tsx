export type ChipTone = "green" | "amber" | "red" | "neutral" | "muted";

const TONE: Record<ChipTone, string> = {
  green: "text-green border border-[rgba(169,227,75,.4)]",
  amber: "text-amber border border-[rgba(230,173,0,.5)]",
  red: "text-red border border-[rgba(255,90,95,.55)]",
  neutral: "text-ink border border-line-strong",
  muted: "text-muted border border-dashed border-line-strong",
};

/** Status/marker chip. `tip` is the plain-language explanation shown on hover. */
export function Chip({ tone, label, tip, pulse = false, className = "" }: {
  tone: ChipTone; label: string; tip?: string; pulse?: boolean; className?: string;
}) {
  return (
    <span
      className={`font-label inline-block whitespace-nowrap rounded-full px-[9px] py-[3px] text-[9px] font-bold ${TONE[tone]} ${pulse ? "risk-pulse" : ""} ${tip ? "cursor-help" : ""} ${className}`}
      data-tip={tip}
    >
      {label}
    </span>
  );
}
