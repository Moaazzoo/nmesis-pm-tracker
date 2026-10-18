/** Turns a Supabase result into data or a thrown error, so a failed read reaches the error boundary instead of rendering as "empty". */
export function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? ([] as unknown as T));
}
