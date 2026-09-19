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
