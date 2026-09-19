import { MutationLimiter } from "../../core/limiter.ts";
import { createBaseProxy } from "./base.ts";
import { resolveSmartBaseConfig } from "./config.ts";
import { smartBaseInstances } from "./instances.ts";
import { createTableWrapper } from "./table.ts";
import type {
  SmartBaseConfig,
  SmartFieldDefinition,
  SmartFieldUpdate,
  SmartTable,
  UnsupportedOptionsAction,
  UpdateFieldsConfig,
} from "./types.ts";

export type {
  SmartBaseConfig,
  SmartFieldDefinition,
  SmartFieldUpdate,
  SmartTable,
  UnsupportedOptionsAction,
  UpdateFieldsConfig,
} from "./types.ts";

/**
 * A proxy-backed Airtable base whose table mutation methods accept arrays of
 * arbitrary length and share one base-wide rate limiter.
 *
 * @example
 * const b = new SmartBase(base);
 * const table = b.tables[0];
 *
 * await table.createRecordsAsync(records);
 * await table.createFieldsAsync([
 *   { name: "Summary", type: "singleLineText" },
 * ]);
 * await table.updateFieldsAsync([
 *   {
 *     field: "Status",
 *     name: "Article Status",
 *     description: "Current editorial workflow state.",
 *     options: { choices: [{ name: "Draft" }, { name: "Published" }] },
 *   },
 * ]);
 */
export class SmartBase {
  constructor(base: AirtableBase, config: SmartBaseConfig = {}) {
    const resolvedConfig = resolveSmartBaseConfig(config);
    const limiter = new MutationLimiter(resolvedConfig.mutationsPerSecond);
    const wrapTable = createTableWrapper({
      recordsPerMutation: resolvedConfig.recordsPerMutation,
      limiter,
    });
    const proxy = createBaseProxy(base, wrapTable) as SmartBase;

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

// Declaration merging exposes the native Airtable base surface while refining
// table-returning members to include SmartTable bulk field helpers.
export interface SmartBase extends AirtableBase {
  readonly tables: SmartTable[];

  getTable(tableIdOrName: string): SmartTable;
  getTableByIdIfExists(tableId: string): SmartTable | null;
  getTableByNameIfExists(tableName: string): SmartTable | null;
}
