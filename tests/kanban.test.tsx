import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { columnsFor, Kanban, COLUMNS } from "@/components/board/kanban";
import type { TaskRow } from "@/lib/queries/board-shape";

const t = (over: Partial<TaskRow>): TaskRow => ({ id: "t", node_id: "u", name: "Lighting-1P", type_name: "Lighting", status_key: "ready", state: "ready", due_date: null, status_since: null, critical: false, note_count: 0, latest_version: null, assignees: [], risk: "none", ...over });

describe("columnsFor", () => {
  it("assigns tasks to the six columns by state and parks blocked/cancelled in the rail", () => {
    const c = columnsFor([t({ id: "a", state: "not_started", status_key: "waiting" }), t({ id: "b", state: "active", status_key: "in_progress" }), t({ id: "c", state: "blocked", status_key: "on_hold" }), t({ id: "d", state: "cancelled", status_key: "cancelled" })]);
    expect(COLUMNS.map((x) => x.title)).toEqual(["Not started", "Ready", "In progress", "In review", "Comments", "Done"]);
    expect(c.columns[0].tasks.map((x) => x.id)).toEqual(["a"]);
    expect(c.columns[2].tasks.map((x) => x.id)).toEqual(["b"]);
    expect(c.rail.map((x) => x.id)).toEqual(["c", "d"]);
  });
});

describe("Kanban drop", () => {
  it("rejects a drop onto a column that is not a legal next status, showing the reason", async () => {
    const onMove = vi.fn();
    render(<Kanban tasks={[t({ id: "a", status_key: "waiting", state: "not_started" })]} unitNames={{ u: "S07" }} legal={{ a: ["ready"] }} onMove={onMove} />);
    const card = screen.getByText("Lighting-1P").closest("[draggable]")!;
    fireEvent.dragStart(card);
    fireEvent.drop(screen.getByTestId("col-done"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/cannot move|not allowed/i));
    expect(onMove).not.toHaveBeenCalled();
  });
  it("calls onMove with the target status on a legal drop", async () => {
    const onMove = vi.fn(async () => ({ ok: true as const }));
    render(<Kanban tasks={[t({ id: "a", status_key: "waiting", state: "not_started" })]} unitNames={{ u: "S07" }} legal={{ a: ["ready"] }} onMove={onMove} />);
    fireEvent.dragStart(screen.getByText("Lighting-1P").closest("[draggable]")!);
    fireEvent.drop(screen.getByTestId("col-ready"));
    await waitFor(() => expect(onMove).toHaveBeenCalledWith({ taskId: "a", to: "ready" }));
  });
});
