import type { QueuedMutation } from "./types.ts";

const WINDOW_MS = 1_000;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** A FIFO limiter shared by every wrapped table in one SmartBase instance. */
export class MutationLimiter {
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

    // Collect all work queued during the current turn into one limiter window.
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

      // Cover work queued between the final queue check and cleanup.
      if (this.#queue.length > 0) {
        this.#scheduleStart();
      }
    }
  }
}
