import { chunk } from "../../core/batching.ts";
import type { MutationLimiter } from "../../core/limiter.ts";
import { resolveUpdateFieldsConfig } from "./config.ts";
import type {
  AirtableField,
  AirtableTable,
  CreateFieldArguments,
  CreateFieldOutput,
  CreateRecordsInput,
  CreateRecordsOutput,
  DeleteRecordsInput,
  ResolvedUpdateFieldsConfig,
  SmartFieldDefinition,
  SmartFieldUpdate,
  SmartTable,
  UpdateFieldOptionsInput,
  UpdateFieldOptionsOpts,
  UpdateFieldsConfig,
  UpdateRecordsInput,
} from "./types.ts";

interface TableWrapperOptions {
  recordsPerMutation: number;
  limiter: MutationLimiter;
}

interface PlannedFieldMutation {
  fieldId: string;
  run: () => Promise<void>;
}

interface ExpectedFieldState {
  name: string;
  description: string | null;
}

interface PermissionCheckResult {
  hasPermission: boolean;
  reasonDisplayString?: string;
}

type PermissionAwareField = AirtableField & {
  checkPermissionsForUpdateOptions?: (
    options?: UpdateFieldOptionsInput,
  ) => PermissionCheckResult;
};

function createField(
  table: AirtableTable,
  field: SmartFieldDefinition,
): Promise<CreateFieldOutput> {
  const args =
    field.options === undefined
      ? [field.name, field.type]
      : [field.name, field.type, field.options];

  return table.createFieldAsync(...(args as CreateFieldArguments));
}

function resolveField(
  table: AirtableTable,
  reference: SmartFieldUpdate["field"],
): AirtableField {
  const idOrName = typeof reference === "string" ? reference : reference.id;
  return table.getField(idOrName) as AirtableField;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isUnsupportedOptionsMessage(message: string): boolean {
  return /(?:not supported|unsupported|no writable options|does not support)/i.test(
    message,
  );
}

function clearlyDoesNotSupportOptions(
  field: AirtableField,
  options: UpdateFieldOptionsInput,
): boolean {
  if (field.options === null) {
    return true;
  }

  const checkPermissions = (field as PermissionAwareField)
    .checkPermissionsForUpdateOptions;

  if (typeof checkPermissions !== "function") {
    return false;
  }

  const result = checkPermissions.call(field, options);
  return (
    !result.hasPermission &&
    isUnsupportedOptionsMessage(result.reasonDisplayString ?? "")
  );
}

function unsupportedOptionsError(field: AirtableField): TypeError {
  return new TypeError(
    `Field "${field.name}" (${field.id}) does not support writable options.`,
  );
}

async function updateFieldOptions(
  field: AirtableField,
  options: UpdateFieldOptionsInput,
  config: ResolvedUpdateFieldsConfig,
): Promise<void> {
  if (clearlyDoesNotSupportOptions(field, options)) {
    if (config.unsupportedOptions === "skip") {
      return;
    }

    throw unsupportedOptionsError(field);
  }

  const opts = {
    enableSelectFieldChoiceDeletion:
      config.enableSelectFieldChoiceDeletion,
  } as UpdateFieldOptionsOpts;

  try {
    await field.updateOptionsAsync(options, opts);
  } catch (error) {
    if (
      config.unsupportedOptions === "skip" &&
      isUnsupportedOptionsMessage(getErrorMessage(error))
    ) {
      return;
    }

    throw error;
  }
}

function planFieldMutations(
  table: AirtableTable,
  updates: readonly SmartFieldUpdate[],
  config: ResolvedUpdateFieldsConfig,
): PlannedFieldMutation[] {
  const expectedStateByFieldId = new Map<string, ExpectedFieldState>();
  const planned: PlannedFieldMutation[] = [];

  // Resolve every string reference before any rename begins.
  const resolved = Array.from(updates, (update) => ({
    update,
    field: resolveField(table, update.field),
  }));

  for (const { update, field } of resolved) {
    let expectedState = expectedStateByFieldId.get(field.id);

    if (!expectedState) {
      expectedState = {
        name: field.name,
        description: field.description,
      };
      expectedStateByFieldId.set(field.id, expectedState);
    }

    if (update.name !== undefined) {
      const name = update.name;

      if (!config.skipUnchanged || expectedState.name !== name) {
        planned.push({
          fieldId: field.id,
          run: () => field.updateNameAsync(name),
        });
      }

      expectedState.name = name;
    }

    if (update.description !== undefined) {
      const description = update.description;

      if (
        !config.skipUnchanged ||
        expectedState.description !== description
      ) {
        planned.push({
          fieldId: field.id,
          run: () => field.updateDescriptionAsync(description),
        });
      }

      expectedState.description = description;
    }

    if (update.options !== undefined) {
      const options = update.options;

      planned.push({
        fieldId: field.id,
        run: () => updateFieldOptions(field, options, config),
      });
    }
  }

  return planned;
}

async function runFieldMutations(
  mutations: readonly PlannedFieldMutation[],
  limiter: MutationLimiter,
): Promise<void> {
  const fieldChains = new Map<string, Promise<void>>();
  const scheduled: Promise<void>[] = [];

  for (const mutation of mutations) {
    const previous = fieldChains.get(mutation.fieldId) ?? Promise.resolve();
    const current = limiter.enqueue(async () => {
      await previous;
      await mutation.run();
    });

    fieldChains.set(mutation.fieldId, current);
    scheduled.push(current);
  }

  await Promise.all(scheduled);
}

export function createTableWrapper({
  recordsPerMutation,
  limiter,
}: TableWrapperOptions): (table: AirtableTable) => SmartTable {
  const tableCache = new WeakMap<object, SmartTable>();

  return (table: AirtableTable): SmartTable => {
    const cached = tableCache.get(table as object);

    if (cached) {
      return cached;
    }

    const methodCache = new Map<PropertyKey, Function>();

    const wrapped = new Proxy(table, {
      get(target, property) {
        const cachedMethod = methodCache.get(property);

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

          methodCache.set(property, method);
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

          methodCache.set(property, method);
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

          methodCache.set(property, method);
          return method;
        }

        if (property === "createFieldsAsync") {
          const method = async (
            fields: readonly SmartFieldDefinition[],
          ): Promise<CreateFieldOutput[]> =>
            Promise.all(
              Array.from(fields, (field) =>
                limiter.enqueue(() => createField(target, field)),
              ),
            );

          methodCache.set(property, method);
          return method;
        }

        if (property === "updateFieldsAsync") {
          const method = async (
            fields: readonly SmartFieldUpdate[],
            config?: UpdateFieldsConfig,
          ): Promise<void> => {
            const resolvedConfig = resolveUpdateFieldsConfig(config);
            const mutations = planFieldMutations(
              target,
              fields,
              resolvedConfig,
            );

            await runFieldMutations(mutations, limiter);
          };

          methodCache.set(property, method);
          return method;
        }

        const value = Reflect.get(target, property, target);

        if (typeof value === "function") {
          const bound = value.bind(target);
          methodCache.set(property, bound);
          return bound;
        }

        return value;
      },

      has(target, property) {
        return (
          property === "createFieldsAsync" ||
          property === "updateFieldsAsync" ||
          Reflect.has(target, property)
        );
      },
    }) as SmartTable;

    tableCache.set(table as object, wrapped);
    return wrapped;
  };
}
