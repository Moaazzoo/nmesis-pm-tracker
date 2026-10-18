import { describe, it, expect } from "vitest";
import { risk, todayInCairo } from "@/lib/risk";

// 2026-10-18 20:30 UTC = 2026-10-18 22:30 Cairo (UTC+2)
const now = new Date("2026-10-18T20:30:00Z");

describe("risk", () => {
  it("no due date is never overdue or at risk", () => {
    expect(risk({ due_date: null, state: "active" }, now)).toBe("none");
  });
  it("due yesterday and still active is overdue", () => {
    expect(risk({ due_date: "2026-10-17", state: "active" }, now)).toBe("overdue");
  });
  it("due yesterday but done is not overdue", () => {
    expect(risk({ due_date: "2026-10-17", state: "done" }, now)).toBe("none");
  });
  it("due in 2 days and not yet started is at risk", () => {
    expect(risk({ due_date: "2026-10-20", state: "ready" }, now)).toBe("at_risk");
  });
  it("due in 2 days and active is fine", () => {
    expect(risk({ due_date: "2026-10-20", state: "active" }, now)).toBe("none");
  });
  it("waiting in review for more than 2 days is at risk", () => {
    expect(risk({ due_date: null, state: "review", in_review_since: "2026-10-15T10:00:00Z" }, now)).toBe("at_risk");
  });
  it("today is computed in Africa/Cairo at day granularity", () => {
    // 23:30 UTC on the 18th is already the 19th in Cairo
    expect(todayInCairo(new Date("2026-10-18T23:30:00Z"))).toBe("2026-10-19");
    expect(risk({ due_date: "2026-10-18", state: "active" }, new Date("2026-10-18T23:30:00Z"))).toBe("overdue");
  });
});
