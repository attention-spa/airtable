import type { MutationLimiter } from "./limiter.ts";
import type {
  AirtableTable,
  CreateFieldArguments,
  CreateFieldOutput,
  CreateRecordsInput,
  CreateRecordsOutput,
  DeleteRecordsInput,
  SmartFieldDefinition,
  SmartTable,
  UpdateRecordsInput,
} from "./types.ts";

interface TableWrapperOptions {
  recordsPerMutation: number;
  limiter: MutationLimiter;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

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

        const value = Reflect.get(target, property, target);

        if (typeof value === "function") {
          const bound = value.bind(target);
          methodCache.set(property, bound);
          return bound;
        }

        return value;
      },

      has(target, property) {
        return property === "createFieldsAsync" || Reflect.has(target, property);
      },
    }) as SmartTable;

    tableCache.set(table as object, wrapped);
    return wrapped;
  };
}
