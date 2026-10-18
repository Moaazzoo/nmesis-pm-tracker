import Link from "next/link";
import { Page } from "@/components/ui/panel";

export default function NotFound() {
  return (
    <Page className="py-16">
      <p className="font-label text-[11px] text-faint">Not found</p>
      <h1 className="mt-2 font-display text-[28px] font-light">There is nothing at this address.</h1>
      <p className="mt-2 text-muted">The project or task may have been archived.</p>
      <Link href="/" className="mt-6 inline-block text-green underline-offset-4 hover:underline">Back to projects</Link>
    </Page>
  );
}
