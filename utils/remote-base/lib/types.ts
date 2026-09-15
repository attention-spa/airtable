export type RemoteBaseConfig = {
    id?: string;
    app?: string;
    auth?: string;
};

export type AirtableRecordFields = Record<string, unknown>;

export type RemoteRecord = {
    id: string;
    name: string;
    fields: AirtableRecordFields;
};

export type RemoteFieldSchema = {
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
    fetchFullRecords(options?: { refresh?: boolean }): Promise<RemoteRecord[]>;
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
    fetchFullData(options?: { refresh?: boolean }): Promise<RemoteBase>;
    [key: string]: unknown;
};

export type DeferredRemoteTable = PromiseLike<RemoteTable> & {
    readonly records: Promise<RemoteRecord[]>;
    fetchFullRecords(options?: { refresh?: boolean }): Promise<RemoteRecord[]>;
    deleteRecords(input: DeleteInput | DeleteInput[]): Promise<DeletedRecord[]>;
    upsertRecords(input: UpsertInput | UpsertInput[], options?: UpsertOptions): Promise<UpsertResult>;
};

export type RemoteBaseHandle = PromiseLike<RemoteBase> & {
    readonly link: Promise<RemoteBase>;
    readonly data: Promise<RemoteBase>;
    readonly table: unknown;
    readonly tables: Promise<RemoteTableRegistry>;
    update(updates: RemoteBaseUpdate): Promise<RemoteBaseUpdateResult>;
    fetchFullData(options?: { refresh?: boolean }): Promise<RemoteBase>;
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

export type RemoteBaseCallable = {
    (...args: Array<string | RemoteBaseConfig>):
        | RemoteBase
        | RemoteBaseHandle
        | RemoteTable
        | DeferredRemoteTable
        | RemoteBaseCallable;
    auth?: string;
    config(value: RemoteBaseConfig): RemoteBase | RemoteBaseHandle | RemoteBaseCallable;
    [key: string]: unknown;
};
