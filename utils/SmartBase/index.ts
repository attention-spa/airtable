/**
 * A transparent, rate-limited wrapper for Airtable's Scripting Extension base.
 *
 * Usage:
 *   const { SmartBase } = await import("https://esm.sh/gh/owner/repo/path/smart-base.ts");
 *   const b = new SmartBase(base);
 *   const ids = await b.tables[0].createRecordsAsync(records);
 */

export interface SmartBaseConfig {
  /** Maximum number of records passed to one Airtable batch mutation. */
  recordsPerMutation?: number;

  /** Maximum number of batch mutations started per one-second window. */
  mutationsPerSecond?: number;
}

type AirtableTable = AirtableBase["tables"][number];
type CreateRecordsInput = Parameters<AirtableTable["createRecordsAsync"]>[0];
type CreateRecordsOutput = Awaited<
  ReturnType<AirtableTable["createRecordsAsync"]>
>;
type UpdateRecordsInput = Parameters<AirtableTable["updateRecordsAsync"]>[0];
type DeleteRecordsInput = Parameters<AirtableTable["deleteRecordsAsync"]>[0];

type QueuedMutation<T> = {
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const DEFAULT_RECORDS_PER_MUTATION = 50;
const DEFAULT_MUTATIONS_PER_SECOND = 5;
const WINDOW_MS = 1_000;
const smartBaseInstances = new WeakSet<object>();

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertIntegerInRange(
  name: string,
  value: number,
  minimum: number,
  maximum?: number,
): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}.`);
  }

  if (maximum !== undefined && value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

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

class MutationLimiter {
  readonly #mutationsPerSecond: number;
  readonly #queue: QueuedMutation<unknown>[] = [];

  #running = false;
  #startScheduled = false;
  #nextWindowAt = 0;

  constructor(mutationsPerSecond: number) {
    this.#mutationsPerSecond = mutationsPerSecond;
  }

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    const promise = new Promise<T>((resolve, reject) => {
      this.#queue.push({ run, resolve, reject } as QueuedMutation<unknown>);
    });

    this.#scheduleStart();
    return promise;
  }

  #scheduleStart(): void {
    if (this.#running || this.#startScheduled) {
      return;
    }

    this.#startScheduled = true;

    // Defer one microtask so all chunks queued by the same method call can be
    // collected into the same Promise.all-backed mutation window.
    void Promise.resolve().then(() => {
      this.#startScheduled = false;
      return this.#drain();
    });
  }

  async #drain(): Promise<void> {
    if (this.#running) {
      return;
    }

    this.#running = true;

    try {
      while (this.#queue.length > 0) {
        const waitForWindow = this.#nextWindowAt - Date.now();

        if (waitForWindow > 0) {
          await sleep(waitForWindow);
        }

        const mutations = this.#queue.splice(0, this.#mutationsPerSecond);
        this.#nextWindowAt = Date.now() + WINDOW_MS;

        const results = await Promise.allSettled(
          mutations.map((mutation) => mutation.run()),
        );

        results.forEach((result, index) => {
          const mutation = mutations[index];

          if (result.status === "fulfilled") {
            mutation.resolve(result.value);
          } else {
            mutation.reject(result.reason);
          }
        });
      }
    } finally {
      this.#running = false;

      // Cover mutations queued between the final queue check and this cleanup.
      if (this.#queue.length > 0) {
        this.#scheduleStart();
      }
    }
  }
}

function createSmartBaseProxy(
  base: AirtableBase,
  config: SmartBaseConfig,
): AirtableBase {
  const recordsPerMutation =
    config.recordsPerMutation ?? DEFAULT_RECORDS_PER_MUTATION;
  const mutationsPerSecond =
    config.mutationsPerSecond ?? DEFAULT_MUTATIONS_PER_SECOND;

  // Airtable's plural mutation methods accept at most 50 records per call.
  assertIntegerInRange("recordsPerMutation", recordsPerMutation, 1, 50);
  assertIntegerInRange("mutationsPerSecond", mutationsPerSecond, 1);

  const limiter = new MutationLimiter(mutationsPerSecond);
  const tableCache = new WeakMap<object, AirtableTable>();
  const baseMethodCache = new Map<PropertyKey, Function>();

  const wrapTable = (table: AirtableTable): AirtableTable => {
    const cached = tableCache.get(table as object);

    if (cached) {
      return cached;
    }

    const tableMethodCache = new Map<PropertyKey, Function>();

    const wrapped = new Proxy(table, {
      get(target, property) {
        const cachedMethod = tableMethodCache.get(property);

        if (cachedMethod) {
          return cachedMethod;
        }

        if (property === "createRecordsAsync") {
          const method = async (
            records: CreateRecordsInput,
          ): Promise<CreateRecordsOutput> => {
            const batches = chunk(
              Array.from(records),
              recordsPerMutation,
            ) as CreateRecordsInput[];

            if (batches.length === 0) {
              return [] as CreateRecordsOutput;
            }

            const results = await Promise.all(
              batches.map((batch) =>
                limiter.enqueue(() => target.createRecordsAsync(batch)),
              ),
            );

            return results.flat() as CreateRecordsOutput;
          };

          tableMethodCache.set(property, method);
          return method;
        }

        if (property === "updateRecordsAsync") {
          const method = async (records: UpdateRecordsInput): Promise<void> => {
            const batches = chunk(
              Array.from(records),
              recordsPerMutation,
            ) as UpdateRecordsInput[];

            await Promise.all(
              batches.map((batch) =>
                limiter.enqueue(() => target.updateRecordsAsync(batch)),
              ),
            );
          };

          tableMethodCache.set(property, method);
          return method;
        }

        if (property === "deleteRecordsAsync") {
          const method = async (recordIds: DeleteRecordsInput): Promise<void> => {
            const batches = chunk(
              Array.from(recordIds),
              recordsPerMutation,
            ) as DeleteRecordsInput[];

            await Promise.all(
              batches.map((batch) =>
                limiter.enqueue(() => target.deleteRecordsAsync(batch)),
              ),
            );
          };

          tableMethodCache.set(property, method);
          return method;
        }

        const value = Reflect.get(target, property, target);

        if (typeof value === "function") {
          const bound = value.bind(target);
          tableMethodCache.set(property, bound);
          return bound;
        }

        return value;
      },
    });

    tableCache.set(table as object, wrapped);
    return wrapped;
  };

  const wrapPossibleTable = (value: unknown): unknown =>
    isTable(value) ? wrapTable(value) : value;

  return new Proxy(base, {
    get(target, property) {
      if (property === "tables") {
        return target.tables.map(wrapTable);
      }

      const cachedMethod = baseMethodCache.get(property);

      if (cachedMethod) {
        return cachedMethod;
      }

      const value = Reflect.get(target, property, target);

      if (typeof value !== "function") {
        return value;
      }

      const bound = (...args: unknown[]) => {
        const result = value.apply(target, args);

        if (result instanceof Promise) {
          return result.then(wrapPossibleTable);
        }

        return wrapPossibleTable(result);
      };

      baseMethodCache.set(property, bound);
      return bound;
    },
  });
}

/**
 * A proxy-backed Airtable base whose table batch-mutation methods accept arrays
 * of arbitrary length and share one base-wide rate limiter.
 */
export class SmartBase {
  constructor(base: AirtableBase, config: SmartBaseConfig = {}) {
    const proxy = createSmartBaseProxy(base, config) as SmartBase;
    smartBaseInstances.add(proxy as object);
    return proxy;
  }

  static [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      smartBaseInstances.has(value as object)
    );
  }
}

// Declaration merging makes `new SmartBase(...)` expose the normal Airtable
// base type in TypeScript while the constructor returns the proxy at runtime.
export interface SmartBase extends AirtableBase {}
