import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StatusControl } from "@/components/tasks/status-control";

describe("#5 network rejection", () => {
  it("reverts and shows an inline error when the action throws", async () => {
    const onChange = vi.fn(async () => { throw new Error("Failed to fetch"); });
    render(<StatusControl taskId="t1" current="ready" options={["in_progress"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /ready to start/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "In Progress" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/could not reach/i));
    expect(screen.getByRole("button", { name: /ready to start/i })).toBeTruthy();
  });
});

describe("#6 server value wins after a refresh", () => {
  it("follows a changed `current` prop instead of keeping stale local state", () => {
    const { rerender } = render(<StatusControl taskId="t1" current="ready" options={["in_progress"]} onChange={vi.fn()} />);
    rerender(<StatusControl taskId="t1" current="completed" options={[]} onChange={vi.fn()} />);
    expect(screen.getByText("Completed")).toBeTruthy();
  });
});
