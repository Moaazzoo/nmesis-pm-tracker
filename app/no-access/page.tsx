import { signOut } from "@/app/login/actions";
import { Page } from "@/components/ui/panel";

export default function NoAccess() {
  return (
    <Page className="py-16">
      <p className="font-label text-[11px] text-red">No access</p>
      <h1 className="mt-2 font-display text-[28px] font-light">Your login isn&apos;t on the tracker roster yet.</h1>
      <p className="mt-2 max-w-[60ch] text-muted">The login worked, but no active tracker profile is linked to it. Ask Moaaz Hashem or Kareem to run the roster seed or link your login on the People page.</p>
      <form action={signOut} className="mt-6"><button className="rounded-full border border-line-strong px-5 py-2 text-[13px] hover:border-green hover:text-green">Sign out</button></form>
    </Page>
  );
}
