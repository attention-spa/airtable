import { describe, expect, it } from "vitest";
import { chunk } from "./batching.ts";
import {
  createReferenceIndex,
  normalizeRef,
  resolveReference,
} from "./reference.ts";

describe("shared Airtable core", () => {
  it("normalizes references consistently", () => {
    expect(normalizeRef("  FiElD Name  ")).toBe("field name");
  });

  it("indexes Airtable objects by both ID and name", () => {
    const field = { id: "fldExample000001", name: "Status" };
    const index = createReferenceIndex([field]);

    expect(resolveReference(index, "FLDEXAMPLE000001")).toBe(field);
    expect(resolveReference(index, " status ")).toBe(field);
  });

  it("chunks values with validated batch sizes", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});
