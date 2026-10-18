import { describe, it, expect } from "vitest";
import { can } from "@/lib/permissions";
import { noteCategoriesFor } from "@/lib/notes";
import type { Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({
  id: role, full_name: role, role, discipline: null, is_admin: false, profile_id: null, ...extra,
});

describe("can", () => {
  it("production may assign", () => expect(can(person("production"), "assign")).toBe(true));
  it("artist may not edit structure", () => expect(can(person("artist"), "edit_structure")).toBe(false));
  it("supervisor may not assign", () => expect(can(person("supervisor"), "assign")).toBe(false));
  it("artist may start own task but not someone else's", () => {
    expect(can(person("artist"), "start", { isAssignee: true })).toBe(true);
    expect(can(person("artist"), "start", { isAssignee: false })).toBe(false);
  });
  it("only admins may use the lens", () => {
    expect(can(person("supervisor", { is_admin: true }), "lens")).toBe(true);
    expect(can(person("supervisor"), "lens")).toBe(false);
  });
  it("viewer may do nothing", () => {
    expect(can(person("viewer"), "start", { isAssignee: true })).toBe(false);
    expect(can(person("viewer"), "note:Production Note")).toBe(false);
  });
});

describe("noteCategoriesFor", () => {
  it("artist gets Artist Note only", () => expect(noteCategoriesFor(person("artist"))).toEqual(["Artist Note"]));
  it("supervisor gets Supervisor Feedback", () => expect(noteCategoriesFor(person("supervisor"))).toEqual(["Supervisor Feedback"]));
  it("production gets every category", () => expect(noteCategoriesFor(person("production")).length).toBe(5));
  it("artist cannot post Client Feedback", () => expect(can(person("artist"), "note:Client Feedback")).toBe(false));
});
