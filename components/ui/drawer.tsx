import Link from "next/link";

/** Right-hand drawer over the current page; closing is a plain link back to the page without the task param. */
export function Drawer({ closeHref, title, children }: { closeHref: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="tk-drawer fixed inset-0 z-50 flex justify-end">
      <Link href={closeHref} className="flex-1 bg-[rgba(0,0,0,.55)]" aria-label="Close" />
      <aside className="flex h-full w-full max-w-[640px] flex-col border-l border-line bg-bg2 shadow-2xl" role="dialog" aria-modal="true">
        <header className="flex items-start gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0 flex-1">{title}</div>
          <Link href={closeHref} className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-muted hover:text-ink">Close</Link>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </aside>
    </div>
  );
}
