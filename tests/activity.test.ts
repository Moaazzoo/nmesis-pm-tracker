import { describe, it, expect } from "vitest";
import { unreadFor, describeActivity, withoutReader } from "@/lib/queries/activity-shape";

const rows = [
  { id: "a1", at: "2026-10-15T12:09:00Z", action: "status", payload: { from: "pending_review", to: "comments" }, unread_by: ["p1", "p2"], actor: "Kareem Abd Elazim", task_name: "Comp-1P", project_name: "SOUEAST_Q3", task_id: "t1", project_id: "pr" },
  { id: "a2", at: "2026-10-16T09:00:00Z", action: "version", payload: { number: 3 }, unread_by: ["p1"], actor: "Ziad Yasser", task_name: "Lighting-1P", project_name: "SOUEAST_Q3", task_id: "t2", project_id: "pr" },
  { id: "a3", at: "2026-10-14T09:00:00Z", action: "note", payload: { category: "Client Feedback" }, unread_by: ["p3"], actor: "Moaaz Hashem", task_name: "Comp-2P", project_name: "Lexus 2026", task_id: "t3", project_id: "pr2" },
];

describe("unreadFor", () => {
  it("keeps only rows whose unread_by contains the person, newest first", () => {
    expect(unreadFor(rows, "p1").map((r) => r.id)).toEqual(["a2", "a1"]);
    expect(unreadFor(rows, "p3").map((r) => r.id)).toEqual(["a3"]);
    expect(unreadFor(rows, "nobody")).toEqual([]);
  });
});

describe("describeActivity", () => {
  it("writes a plain sentence: who did what on which task", () => {
    expect(describeActivity(rows[0])).toBe("Kareem Abd Elazim moved Comp-1P from Pending Review to Comments");
    expect(describeActivity(rows[1])).toBe("Ziad Yasser submitted version 3 of Lighting-1P");
    expect(describeActivity(rows[2])).toBe("Moaaz Hashem added a Client Feedback on Comp-2P");
  });
});

describe("withoutReader", () => {
  it("removes the reader from unread_by and leaves others", () => {
    expect(withoutReader(["p1", "p2"], "p1")).toEqual(["p2"]);
  });
});
