import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie and gates every page behind login. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !anon && "NEXT_PUBLIC_SUPABASE_ANON_KEY", !process.env.SUPABASE_SERVICE_KEY && "SUPABASE_SERVICE_KEY"].filter(Boolean).join(", ");
    return new NextResponse(`NMESIS Tracker is not configured on this server yet.\nMissing environment variable(s): ${missing}.\nAdd them (Vercel → Settings → Environment Variables) and redeploy.`, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  if (user && pathname === "/no-access") return response;
  if (!user && pathname !== "/login") {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone(); url.pathname = "/"; url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|woff2)$).*)"],
};
