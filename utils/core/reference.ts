export interface AirtableNamedReference {
  readonly id: string;
  readonly name: string;
}

export function normalizeRef(value: unknown): string {
  return String(value).trim().toLowerCase();
}

export function createReferenceIndex<T extends AirtableNamedReference>(
  values: readonly T[],
): Map<string, T> {
  const index = new Map<string, T>();

  for (const value of values) {
    index.set(normalizeRef(value.id), value);
    index.set(normalizeRef(value.name), value);
  }

  return index;
}

export function resolveReference<T extends AirtableNamedReference>(
  index: ReadonlyMap<string, T>,
  reference: unknown,
): T | undefined {
  return index.get(normalizeRef(reference));
}
