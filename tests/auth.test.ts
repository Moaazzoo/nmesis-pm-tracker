import { describe, it, expect } from "vitest";
import { landingFor, effectiveRole } from "@/lib/auth-rules";
import type { Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({
  id: role, full_name: role, role, discipline: null, is_admin: false, profile_id: "pr", ...extra,
});

describe("landingFor", () => {
  it("production and viewers land on Projects", () => {
    expect(landingFor("production")).toBe("/");
    expect(landingFor("viewer")).toBe("/");
  });
  it("artists land on My Queue", () => expect(landingFor("artist")).toBe("/me"));
  it("supervisors land on the Review queue", () => expect(landingFor("supervisor")).toBe("/review"));
});

describe("effectiveRole", () => {
  it("an admin with a lens cookie acts as that role", () => {
    expect(effectiveRole(person("supervisor", { is_admin: true }), "artist")).toBe("artist");
  });
  it("a non-admin ignores the lens cookie", () => {
    expect(effectiveRole(person("artist"), "production")).toBe("artist");
  });
  it("an invalid lens value is ignored", () => {
    expect(effectiveRole(person("supervisor", { is_admin: true }), "nonsense")).toBe("supervisor");
  });
  it("no cookie means own role", () => {
    expect(effectiveRole(person("production"), undefined)).toBe("production");
  });
});
