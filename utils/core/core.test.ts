import { describe, expect, it, vi } from "vitest";
import { chunk, runInBatches } from "./batching.ts";
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

  it("runs batches sequentially through a caller-owned operation", async () => {
    const calls: number[][] = [];
    const run = vi.fn(async (batch: readonly number[]) => {
      calls.push([...batch]);
    });

    await expect(runInBatches([1, 2, 3, 4, 5], 2, run)).resolves.toBe(3);
    expect(calls).toEqual([[1, 2], [3, 4], [5]]);
    expect(run).toHaveBeenCalledTimes(3);
  });
});
