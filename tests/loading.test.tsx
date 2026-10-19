import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLoading from "@/app/loading";
import ProjectLoading from "@/app/p/[id]/loading";

describe("loading skeletons", () => {
  it("the app-level skeleton announces itself to assistive tech", () => {
    render(<RootLoading />);
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
  });
  it("the project-level skeleton announces itself too", () => {
    render(<ProjectLoading />);
    expect(screen.getByRole("status").textContent).toMatch(/loading/i);
  });
});
