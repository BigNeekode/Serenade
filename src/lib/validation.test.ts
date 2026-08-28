import { describe, expect, it } from "vitest";
import {
  isValidId,
  isValidPath,
  isValidTaskTitle,
  validateCreateTaskInput,
} from "@/lib/validation";

describe("validation", () => {
  it("accepts conservative ids and rejects injection attempts", () => {
    expect(isValidId("t_1042")).toBe(true);
    expect(isValidId("p_atlas")).toBe(true);
    expect(isValidId("hand; rm -rf /")).toBe(false);
    expect(isValidId("")).toBe(false);
    expect(isValidId("a".repeat(65))).toBe(false);
  });

  it("validates task titles", () => {
    expect(isValidTaskTitle("Add pagination")).toBe(true);
    expect(isValidTaskTitle("no")).toBe(false);
    expect(isValidTaskTitle("   ")).toBe(false);
  });

  it("rejects paths with null bytes", () => {
    expect(isValidPath("C:\\dev\\repo")).toBe(true);
    expect(isValidPath("bad\0path")).toBe(false);
    expect(isValidPath("")).toBe(false);
  });

  it("validates create task input end to end", () => {
    const errors = validateCreateTaskInput({
      projectId: "p_atlas",
      title: "Do the thing",
      type: "ship",
      executionClass: "standard",
    });
    expect(errors).toHaveLength(0);

    const bad = validateCreateTaskInput({
      projectId: "../etc",
      title: "x",
      type: "ship",
      executionClass: "standard",
    });
    expect(bad).toHaveLength(2);
  });
});
