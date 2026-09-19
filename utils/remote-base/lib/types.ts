export type RemoteBaseConfig = {
    id?: string;
    app?: string;
    auth?: string;
};

export type AirtableRecordFields = Record<string, unknown>;
export type AirtableRecordStrings = Record<string, string>;

export type RemoteRecordFieldData = {
    values: AirtableRecordFields;
    strings: AirtableRecordStrings;
};

export type RemoteReadFormat = 'values' | 'strings' | 'both';

export type RemoteReadOptions = {
    refresh?: boolean;
    format?: RemoteReadFormat;
};

export type RemoteHiddenMetadataKey = null | boolean | string;

export type RemoteHiddenMetadataType =
    | 'record'
    | 'field'
    | 'fieldOptions'
    | 'table'
    | 'view'
    | 'cellValue'
    | 'cellStringValue'
    | 'base';

export type RemoteHiddenMetadata = {
    type: RemoteHiddenMetadataType;
    readonly parent: unknown;
};

export type RemoteFullDataOptions = RemoteReadOptions & {
    followRecordLinks?: boolean;
    hiddenMetadataKey?: RemoteHiddenMetadataKey;
};

export type RemoteRecord = {
    id: string;
    name: string;
    field: RemoteRecordFieldData;
    fields: AirtableRecordFields;
};

export type RemoteFieldOptions = Record<string, unknown>;

export type RemoteFieldSchema = {
    id: string;
    name: string;
    type?: string;
    options?: RemoteFieldOptions;
    [key: string]: unknown;
};

export type RemoteViewSchema = {
    id: string;
    name: string;
    type?: string;
    [key: string]: unknown;
};

export type RemoteTableSchema = {
    id: string;
    name: string;
    primaryFieldId: string;
    fields: RemoteFieldSchema[];
    views?: RemoteViewSchema[];
    [key: string]: unknown;
};

export type RemoteBaseSchema = {
    id: string;
    name?: string;
    [key: string]: unknown;
};

export type UpsertInput = {
    id?: string;
    fields: AirtableRecordFields;
};

export type DeleteInput =
    | string
    | { id: string; delete?: true }
    | { delete: string; id?: string };

export type UpsertOptions = {
    fieldsToMergeOn?: string[];
    typecast?: boolean;
};

export type UpsertResult = {
    records: RemoteRecord[];
    createdRecords: string[];
    updatedRecords: string[];
};

export type DeletedRecord = {
    id: string;
    deleted: boolean;
};

export type RemoteTable = RemoteTableSchema & {
    readonly records: RemoteRecord[] | Promise<RemoteRecord[]>;
    fetchFullRecords(options?: RemoteReadOptions): Promise<RemoteRecord[]>;
    deleteRecords(input: DeleteInput | DeleteInput[]): Promise<DeletedRecord[]>;
    upsertRecords(input: UpsertInput | UpsertInput[], options?: UpsertOptions): Promise<UpsertResult>;
    field(ref: string): RemoteFieldSchema | undefined;
    record(id: string): RemoteRecord | undefined;
};

export type RemoteTableRegistry = RemoteTable[] & {
    get(ref: string): RemoteTable | undefined;
};

export type UpdateRecordInput =
    | UpsertInput
    | { id: string; delete: true }
    | { delete: string };

export type RemoteBaseUpdateOperation = UpsertOptions & {
    records: UpdateRecordInput[];
};

export type RemoteBaseUpdate = Record<string, RemoteBaseUpdateOperation>;

export type RemoteBaseUpdateResult = Record<string, {
    records: RemoteRecord[];
    createdRecords: string[];
    updatedRecords: string[];
    deletedRecords: DeletedRecord[];
}>;

export type RemoteBase = RemoteBaseSchema & {
    tables: RemoteTableRegistry;
    table: RemoteTableRegistry;
    readonly link: Promise<RemoteBase>;
    readonly data: Promise<RemoteBase>;
    update(updates: RemoteBaseUpdate): Promise<RemoteBaseUpdateResult>;
    fetchFullData(options?: RemoteFullDataOptions): Promise<RemoteBase>;
    [key: string]: unknown;
};

export type DeferredRemoteTable = PromiseLike<RemoteTable> & {
    readonly records: Promise<RemoteRecord[]>;
    fetchFullRecords(options?: RemoteReadOptions): Promise<RemoteRecord[]>;
    deleteRecords(input: DeleteInput | DeleteInput[]): Promise<DeletedRecord[]>;
    upsertRecords(input: UpsertInput | UpsertInput[], options?: UpsertOptions): Promise<UpsertResult>;
};

export type RemoteBaseHandle = PromiseLike<RemoteBase> & {
    readonly link: Promise<RemoteBase>;
    readonly data: Promise<RemoteBase>;
    readonly table: unknown;
    readonly tables: Promise<RemoteTableRegistry>;
    update(updates: RemoteBaseUpdate): Promise<RemoteBaseUpdateResult>;
    fetchFullData(options?: RemoteFullDataOptions): Promise<RemoteBase>;
    [key: string]: unknown;
};

export type RemoteBaseState = {
    baseId: string;
    base: RemoteBase | null;
    linking: Promise<RemoteBase> | null;
    handle: RemoteBaseHandle | null;
};

export type ParsedConnectionArgs = {
    id?: string;
    table?: string;
    auth?: string;
};

export type AirtableRequest = <T = unknown>(
    path: string,
    options?: {
        method?: string;
        body?: unknown;
        retries?: number;
    }
) => Promise<T>;
