export function chunk<T>(
  values: readonly T[],
  size: number,
): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("Batch size must be a positive integer.");
  }

  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

/**
 * Runs one asynchronous operation per validated batch, sequentially.
 *
 * Runtime-specific adapters keep ownership of the actual Airtable mutation;
 * this helper owns only generic batching/order semantics.
 */
export async function runInBatches<T>(
  values: readonly T[],
  size: number,
  run: (batch: readonly T[]) => Promise<unknown>,
): Promise<number> {
  const batches = chunk(values, size);

  for (const batch of batches) {
    await run(batch);
  }

  return batches.length;
}
