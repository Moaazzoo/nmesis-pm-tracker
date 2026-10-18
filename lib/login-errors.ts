/** Turns a Supabase sign-in error message into a short code the login page can explain. */
export type LoginErrorCode = "invalid" | "config" | "disabled" | "unconfirmed" | "rate" | "other";

export function loginErrorCode(message: string): LoginErrorCode {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "invalid";
  if (m.includes("api key") || m.includes("apikey")) return "config";
  if (m.includes("logins are disabled") || m.includes("provider is disabled")) return "disabled";
  if (m.includes("not confirmed")) return "unconfirmed";
  if (m.includes("rate limit") || m.includes("too many")) return "rate";
  return "other";
}

/** Where to send the browser after a failed sign-in. Unknown failures carry the service's message so it can be shown. */
export function loginFailurePath(message: string): string {
  const code = loginErrorCode(message);
  if (code !== "other") return `/login?error=${code}`;
  return `/login?error=other&detail=${encodeURIComponent(message.slice(0, 120))}`;
}
