"use client";

import { Page } from "@/components/ui/panel";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Page className="py-16">
      <p className="font-label text-[11px] text-red">Something went wrong</p>
      <h1 className="mt-2 font-display text-[28px] font-light">This page could not be loaded.</h1>
      <p className="mt-2 text-muted">Nothing was changed. Try again; if it keeps happening, tell production.</p>
      <button onClick={reset} className="mt-6 rounded-full border border-line-strong px-5 py-2 text-[13px] hover:border-green hover:text-green">Retry</button>
    </Page>
  );
}
