import { signIn } from "./actions";

const MESSAGES: Record<string, string> = {
  invalid: "That username and password don't match.",
  missing: "Enter your username and password.",
  config: "The app cannot reach the login service: its Supabase key was rejected. Check the NEXT_PUBLIC_SUPABASE_ANON_KEY setting on Vercel.",
  disabled: "Email sign-in is switched off in Supabase (Authentication → Providers → Email).",
  unconfirmed: "This login exists but its email is not confirmed yet. An admin can confirm it in Supabase.",
  rate: "Too many attempts. Wait a minute and try again.",
  other: "Could not sign in. The login service returned an unexpected error.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={signIn} className="w-full max-w-[380px] rounded-[16px] border border-line bg-[linear-gradient(180deg,var(--panel),var(--bg2))] p-7">
        <p className="font-label text-[12px] font-bold tracking-[.26em] text-ink">NMESIS<span className="text-green"> TRACKER</span></p>
        <h1 className="mt-3 font-display text-[26px] font-light">Sign in</h1>
        <p className="mt-1 text-[13px] text-muted">Your studio username, without the @nmesis.io part.</p>
        <label className="mt-6 block">
          <span className="font-label text-[10px] text-faint">Username</span>
          <input name="username" autoComplete="username" required className="tk-input mt-1 w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-ink outline-none focus:border-green" />
        </label>
        <label className="mt-4 block">
          <span className="font-label text-[10px] text-faint">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="tk-input mt-1 w-full rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-ink outline-none focus:border-green" />
        </label>
        {error && <p className="mt-4 text-[13px] text-red" role="alert">{MESSAGES[error] ?? "Could not sign in."}</p>}
        <button type="submit" className="mt-6 w-full rounded-full bg-green px-5 py-2.5 font-label text-[11px] font-bold text-[#0a0c0a] hover:brightness-110">Sign in</button>
        <p className="mt-4 text-[12px] text-faint">No account yet? Production creates logins; ask Moaaz Hashem or Kareem.</p>
      </form>
    </main>
  );
}
