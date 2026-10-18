import { describe, it, expect } from "vitest";
import { parsePass, nextPass } from "@/lib/passes";

describe("parsePass", () => {
  it("Lighting-2P", () => expect(parsePass("Lighting-2P")).toEqual({ base: "Lighting", pass_no: 2 }));
  it("Matte Painting - 1P", () => expect(parsePass("Matte Painting - 1P")).toEqual({ base: "Matte Painting", pass_no: 1 }));
  it("trailing space, no pass", () => expect(parsePass("Rigging ")).toEqual({ base: "Rigging", pass_no: null }));
  it("Comp-1P", () => expect(parsePass("Comp-1P")).toEqual({ base: "Comp", pass_no: 1 }));
});

describe("nextPass", () => {
  const tasks = [
    { id: "a", name: "Lighting-1P", type_id: "lighting", node_id: "n1" },
    { id: "b", name: "Lighting-2P", type_id: "lighting", node_id: "n1" },
    { id: "c", name: "Comp-1P", type_id: "comp", node_id: "n1" },
    { id: "d", name: "Lighting-2P", type_id: "lighting", node_id: "n2" },
  ];
  it("chains to the next pass of the same type under the same unit", () => {
    expect(nextPass(tasks, tasks[0])?.id).toBe("b");
  });
  it("ignores other types and other units", () => {
    expect(nextPass(tasks, tasks[2])).toBeNull();
    expect(nextPass(tasks, tasks[1])).toBeNull();
  });
});
