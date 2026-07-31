import type {
  ResolvedSmartBaseConfig,
  SmartBaseConfig,
} from "./types.ts";

const DEFAULT_RECORDS_PER_MUTATION = 50;
const DEFAULT_MUTATIONS_PER_SECOND = 5;

function assertIntegerInRange(
  name: string,
  value: number,
  minimum: number,
  maximum?: number,
): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(
      `${name} must be an integer greater than or equal to ${minimum}.`,
    );
  }

  if (maximum !== undefined && value > maximum) {
    throw new RangeError(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
}

export function resolveSmartBaseConfig(
  config: SmartBaseConfig,
): ResolvedSmartBaseConfig {
  const recordsPerMutation =
    config.recordsPerMutation ?? DEFAULT_RECORDS_PER_MUTATION;
  const mutationsPerSecond =
    config.mutationsPerSecond ?? DEFAULT_MUTATIONS_PER_SECOND;

  // Airtable's plural record mutation methods accept at most 50 records.
  assertIntegerInRange("recordsPerMutation", recordsPerMutation, 1, 50);
  assertIntegerInRange("mutationsPerSecond", mutationsPerSecond, 1);

  return {
    recordsPerMutation,
    mutationsPerSecond,
  };
}
