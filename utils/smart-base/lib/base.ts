import type { AirtableTable, SmartTable } from "./types.ts";

function isTable(value: unknown): value is AirtableTable {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AirtableTable>;

  return (
    typeof candidate.createRecordsAsync === "function" &&
    typeof candidate.updateRecordsAsync === "function" &&
    typeof candidate.deleteRecordsAsync === "function"
  );
}

function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as PromiseLike<T>).then === "function"
  );
}

export function createBaseProxy(
  base: AirtableBase,
  wrapTable: (table: AirtableTable) => SmartTable,
): AirtableBase {
  const methodCache = new Map<PropertyKey, Function>();

  const wrapPossibleTables = (value: unknown): unknown => {
    if (isTable(value)) {
      return wrapTable(value);
    }

    if (Array.isArray(value)) {
      return value.map(wrapPossibleTables);
    }

    return value;
  };

  return new Proxy(base, {
    get(target, property) {
      if (property === "tables") {
        return target.tables.map(wrapTable);
      }

      const cachedMethod = methodCache.get(property);

      if (cachedMethod) {
        return cachedMethod;
      }

      const value = Reflect.get(target, property, target);

      if (typeof value !== "function") {
        return value;
      }

      const bound = (...args: unknown[]) => {
        const result = value.apply(target, args);

        if (isPromiseLike(result)) {
          return Promise.resolve(result).then(wrapPossibleTables);
        }

        return wrapPossibleTables(result);
      };

      methodCache.set(property, bound);
      return bound;
    },
  });
}
