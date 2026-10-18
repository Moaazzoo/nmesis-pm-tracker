import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-backed client for server components and server actions (anon key; acts as the logged-in user). */
export async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(toSet) {
        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* read-only context (server component) */ }
      },
    },
  });
}
