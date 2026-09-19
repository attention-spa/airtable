const WINDOW_MS = 1_000;

type QueuedOperation<T> = {
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * FIFO limiter that starts at most the configured number of operations in one
 * one-second window. Callers decide the scope by sharing one instance.
 */
export class OperationLimiter {
  readonly #operationsPerSecond: number;
  readonly #queue: QueuedOperation<unknown>[] = [];

  #running = false;
  #startScheduled = false;
  #nextWindowAt = 0;

  constructor(operationsPerSecond: number) {
    if (!Number.isInteger(operationsPerSecond) || operationsPerSecond < 1) {
      throw new RangeError(
        "operationsPerSecond must be a positive integer.",
      );
    }

    this.#operationsPerSecond = operationsPerSecond;
  }

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    const promise = new Promise<T>((resolve, reject) => {
      this.#queue.push({ run, resolve, reject } as QueuedOperation<unknown>);
    });

    this.#scheduleStart();
    return promise;
  }

  #scheduleStart(): void {
    if (this.#running || this.#startScheduled) {
      return;
    }

    this.#startScheduled = true;

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

        const operations = this.#queue.splice(0, this.#operationsPerSecond);
        this.#nextWindowAt = Date.now() + WINDOW_MS;

        const executions = operations.map(async (operation) => {
          try {
            const value = await operation.run();
            operation.resolve(value);
          } catch (error) {
            operation.reject(error);
          }
        });

        await Promise.allSettled(executions);
      }
    } finally {
      this.#running = false;

      if (this.#queue.length > 0) {
        this.#scheduleStart();
      }
    }
  }
}

/** Backward-compatible name for SmartBase's mutation-specific use. */
export { OperationLimiter as MutationLimiter };
