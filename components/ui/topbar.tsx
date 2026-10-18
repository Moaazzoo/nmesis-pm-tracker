import Link from "next/link";
import type { ReactNode } from "react";
import { PAGE } from "./panel";

export function TopBar({ crumb = [], right }: { crumb?: { label: string; href?: string }[]; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[rgba(6,7,6,.86)] backdrop-blur">
      <div className={`${PAGE} flex h-14 items-center gap-4`}>
        <Link href="/" className="font-label text-[12px] font-bold tracking-[.26em] text-ink">NMESIS<span className="text-green"> TRACKER</span></Link>
        <nav className="flex items-center gap-2 text-[13px] text-muted" aria-label="Breadcrumb">
          {crumb.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="text-faint">/</span>
              {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span className="text-ink">{c.label}</span>}
            </span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <nav className="hidden items-center gap-1 text-[12px] md:flex" aria-label="Main">
            <Link href="/" className="rounded-full px-2.5 py-1 text-muted hover:text-ink">Projects</Link>
            <Link href="/me" className="rounded-full px-2.5 py-1 text-muted hover:text-ink">My Queue</Link>
            <Link href="/review" className="rounded-full px-2.5 py-1 text-muted hover:text-ink">Review</Link>
          </nav>
          {right}
        </div>
      </div>
    </header>
  );
}
