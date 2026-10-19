import { describe, it, expect, vi } from "vitest";

// The logged-in person must be resolved from the locally verified token claims,
// not from a network round trip to the auth server on every request.
const getUser = vi.fn(async () => { throw new Error("getUser must not be called: it costs a network hop per request"); });
const getClaims = vi.fn(async () => ({ data: { claims: { sub: "user-1" } }, error: null }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/supabase/server", () => ({ serverClient: async () => ({ auth: { getUser, getClaims } }) }));
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => table === "profiles"
            ? { data: { id: "user-1", username: "kareem", full_name: "Kareem", active: true } }
            : { data: { id: "p1", full_name: "Kareem", role: "supervisor", discipline: "CG", is_admin: true, profile_id: "user-1", active: true } },
        }),
      }),
    }),
  }),
}));

describe("getCurrentPerson", () => {
  it("resolves the person from verified claims without a network auth call", async () => {
    const { getCurrentPerson } = await import("@/lib/auth");
    const person = await getCurrentPerson();
    expect(person?.username).toBe("kareem");
    expect(person?.role).toBe("supervisor");
    expect(getClaims).toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
  it("returns null when there is no session", async () => {
    getClaims.mockResolvedValueOnce({ data: null as never, error: null });
    const { getCurrentPerson } = await import("@/lib/auth");
    expect(await getCurrentPerson()).toBeNull();
  });
});
