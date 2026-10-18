import { describe, it, expect } from "vitest";
import { legalNext, canTransition } from "@/lib/transitions";
import type { Person } from "@/lib/types";

const person = (role: Person["role"], extra: Partial<Person> = {}): Person => ({
  id: role, full_name: role, role, discipline: null, is_admin: false, profile_id: null, ...extra,
});
const artist = person("artist");
const supervisor = person("supervisor", { discipline: "CG" });
const production = person("production");
const viewer = person("viewer");

describe("legalNext", () => {
  it("artist assigned to an In Progress task may only move it to Pending Review", () => {
    expect(legalNext("in_progress", artist, { isAssignee: true })).toEqual(["pending_review"]);
  });
  it("artist who is not the assignee may do nothing", () => {
    expect(legalNext("in_progress", artist, { isAssignee: false })).toEqual([]);
  });
  it("supervisor from Pending Review may complete or send back", () => {
    expect(legalNext("pending_review", supervisor, { isAssignee: false })).toEqual(["completed", "comments"]);
  });
  it("production from Waiting may set Ready to start, On Hold or Cancelled", () => {
    expect(legalNext("waiting", production, { isAssignee: false })).toEqual(["ready", "on_hold", "cancelled"]);
  });
  it("production may reopen a Completed task to Comments or In Progress", () => {
    expect(legalNext("completed", production, { isAssignee: false })).toEqual(["comments", "in_progress"]);
  });
  it("artist cannot leave Completed", () => {
    expect(legalNext("completed", artist, { isAssignee: true })).toEqual([]);
  });
  it("viewer can do nothing anywhere", () => {
    for (const s of ["waiting", "ready", "in_progress", "pending_review", "comments", "completed", "on_hold", "cancelled"] as const) {
      expect(legalNext(s, viewer, { isAssignee: false })).toEqual([]);
    }
  });
});

describe("canTransition", () => {
  it("sending back to Comments requires a note", () => {
    expect(canTransition("pending_review", "comments", supervisor, { isAssignee: false })).toEqual({ ok: true, needsNote: true });
  });
  it("reopening a Completed task requires a note", () => {
    expect(canTransition("completed", "in_progress", production, { isAssignee: false })).toEqual({ ok: true, needsNote: true });
  });
  it("an illegal move is refused with a reason", () => {
    const r = canTransition("waiting", "completed", artist, { isAssignee: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/artist/i);
  });
});
