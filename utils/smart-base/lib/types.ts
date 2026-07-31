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

export type UnsupportedOptionsAction = "throw" | "skip";

export interface UpdateFieldsConfig {
  /**
   * Allows select choices omitted from an update to be deleted.
   *
   * Default: false.
   */
  enableSelectFieldChoiceDeletion?: boolean;

  /**
   * Skips name and description mutations that would not change their values.
   * Field options are always updated when supplied.
   *
   * Default: true.
   */
  skipUnchanged?: boolean;

  /**
   * Determines what happens when options are supplied for a field whose
   * options Airtable reports as non-writable or unsupported.
   *
   * Default: "throw".
   */
  unsupportedOptions?: UnsupportedOptionsAction;
}

export interface ResolvedUpdateFieldsConfig {
  enableSelectFieldChoiceDeletion: boolean;
  skipUnchanged: boolean;
  unsupportedOptions: UnsupportedOptionsAction;
}

export type AirtableTable = AirtableBase["tables"][number];
export type AirtableField = AirtableTable["fields"][number];

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

export type UpdateFieldNameInput = Parameters<
  AirtableField["updateNameAsync"]
>[0];

export type UpdateFieldDescriptionInput = Parameters<
  AirtableField["updateDescriptionAsync"]
>[0];

export type UpdateFieldOptionsArguments = Parameters<
  AirtableField["updateOptionsAsync"]
>;

export type UpdateFieldOptionsInput = UpdateFieldOptionsArguments[0];
export type UpdateFieldOptionsOpts = UpdateFieldOptionsArguments[1];

/** A field definition accepted by SmartTable#createFieldsAsync. */
export interface SmartFieldDefinition {
  name: CreateFieldArguments[0];
  type: CreateFieldArguments[1];
  options?: CreateFieldArguments[2];
}

/** A field mutation definition accepted by SmartTable#updateFieldsAsync. */
export interface SmartFieldUpdate {
  /** Existing field object, ID, or name. */
  field: AirtableField | string;

  /** New field name. */
  name?: UpdateFieldNameInput;

  /** New description, or null to clear it. */
  description?: UpdateFieldDescriptionInput;

  /** Complete replacement options accepted by Field#updateOptionsAsync. */
  options?: UpdateFieldOptionsInput;
}

/** An Airtable table with rate-limited bulk field helpers. */
export type SmartTable = AirtableTable & {
  createFieldsAsync(
    fields: readonly SmartFieldDefinition[],
  ): Promise<CreateFieldOutput[]>;

  updateFieldsAsync(
    fields: readonly SmartFieldUpdate[],
    config?: UpdateFieldsConfig,
  ): Promise<void>;
};

export type QueuedMutation<T> = {
  run: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};
