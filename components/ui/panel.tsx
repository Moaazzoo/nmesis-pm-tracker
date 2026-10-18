import type { ReactNode } from "react";

/** One shape language for every page: container and panel come from here. */
export const PAGE = "mx-auto max-w-[1280px] px-[clamp(16px,3vw,36px)]";
export const PANEL = "rounded-[16px] border border-line bg-[linear-gradient(180deg,var(--panel),var(--bg2))]";

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${PAGE} ${className}`}>{children}</div>;
}

export function Panel({ label, children, className = "", accent = false }: {
  label?: string; children: ReactNode; className?: string; accent?: boolean;
}) {
  return (
    <div className={`${accent ? "rounded-[16px] border border-[rgba(169,227,75,.28)] bg-[rgba(169,227,75,.04)]" : PANEL} p-5 ${className}`}>
      {label && <p className="font-label mb-3 text-[10px] font-bold tracking-[.14em] text-faint">{label}</p>}
      {children}
    </div>
  );
}
