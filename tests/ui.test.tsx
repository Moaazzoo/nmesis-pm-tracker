import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { Legend } from "@/components/ui/legend";

describe("ui primitives", () => {
  it("Chip renders its label and exposes the tip", () => {
    render(<Chip tone="green" label="Completed" tip="Task is done" />);
    const chip = screen.getByText("Completed");
    expect(chip.getAttribute("data-tip")).toBe("Task is done");
  });

  it("Avatar shows two-letter initials from a full name", () => {
    render(<Avatar name="Ziad Yasser" />);
    expect(screen.getByText("ZY")).toBeTruthy();
  });

  it("Empty renders the title and the hint", () => {
    render(<Empty title="No tasks yet" hint="Production adds tasks from Setup" />);
    expect(screen.getByText("No tasks yet")).toBeTruthy();
    expect(screen.getByText("Production adds tasks from Setup")).toBeTruthy();
  });

  it("Legend renders one row per item with its meaning", () => {
    render(
      <Legend
        items={[
          { tone: "green", label: "Completed", meaning: "Approved and done" },
          { tone: "red", label: "Overdue", meaning: "Due date has passed" },
        ]}
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Due date has passed")).toBeTruthy();
  });
});
