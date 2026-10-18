import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StatusControl } from "@/components/tasks/status-control";

describe("StatusControl", () => {
  it("offers only the legal next statuses for the actor", () => {
    render(<StatusControl taskId="t1" current="pending_review" options={["completed", "comments"]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /pending review/i }));
    const items = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(items).toEqual(["Completed", "Comments"]);
  });
  it("shows the previous status and an error chip when the server refuses", async () => {
    const onChange = vi.fn(async () => ({ ok: false as const, error: "A feedback note is required." }));
    render(<StatusControl taskId="t1" current="pending_review" options={["completed", "comments"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /pending review/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Completed" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("A feedback note is required."));
    expect(screen.getByRole("button", { name: /pending review/i })).toBeTruthy();
  });
});
