export interface SmartBaseConfig {
  /** Maximum number of records passed to one Airtable batch mutation. */
  recordsPerMutation?: number;

  /** Maximum number of mutations started per one-second window. */
  mutationsPerSecond?: number;
}

export interface ResolvedSmartBaseConfig {
  recordsPerMutation: number;
  mutationsPerSecond: number;
}

export type AirtableTable = Base["tables"][number];

export type CreateRecordsInput = Parameters<
  AirtableTable["createRecordsAsync"]
>[0];

export type CreateRecordsOutput = Awaited<
  ReturnType<AirtableTable["createRecordsAsync"]>
>;

export type UpdateRecordsInput = Parameters<
  AirtableTable["updateRecordsAsync"]
>[0];

export type DeleteRecordsInput = Parameters<
  AirtableTable["deleteRecordsAsync"]
>[0];

export type CreateFieldArguments = Parameters<
  AirtableTable["createFieldAsync"]
>;

export type CreateFieldOutput = Awaited<
  ReturnType<AirtableTable["createFieldAsync"]>
>;

/** A field definition accepted by SmartTable#createFieldsAsync. */
export interface SmartFieldDefinition {
  name: CreateFieldArguments[0];
  type: CreateFieldArguments[1];
  options?: CreateFieldArguments[2];
}

/** An Airtable table with rate-limited bulk field creation. */
export type SmartTable = AirtableTable & {
  createFieldsAsync(
    fields: readonly SmartFieldDefinition[],
  ): Promise<CreateFieldOutput[]>;
};

export type QueuedMutation<T> = {
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};
