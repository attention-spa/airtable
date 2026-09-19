import { normalizeRef } from './config.ts';
import { createRemoteTable } from './table.ts';
import type {
    AirtableRequest,
    RemoteBase,
    RemoteBaseSchema,
    RemoteBaseUpdate,
    RemoteBaseUpdateResult,
    RemoteFieldSchema,
    RemoteFullDataOptions,
    RemoteHiddenMetadataType,
    RemoteLinkedRecordRef,
    RemoteRecord,
    RemoteTable,
    RemoteTableRegistry,
    RemoteTableSchema,
} from './types.ts';

const DEFAULT_HIDDEN_METADATA_KEY = 'meta';
const RESERVED_RECORD_KEYS = new Set(['id', 'name', 'field', 'fields']);
const installedMetadataKeys = new WeakMap<object, string>();
const rawLinkedCellValues = new WeakMap<object, Map<string, unknown>>();

function resolveHiddenMetadataKey(
    value: RemoteFullDataOptions['hiddenMetadataKey'],
): string | null {
    if (value === false || value === null) return null;

    const key = value === true || value === undefined
        ? DEFAULT_HIDDEN_METADATA_KEY
        : value.trim();

    if (!key || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
        throw new TypeError(
            'hiddenMetadataKey must be null, false, true, or a valid JavaScript property name.'
        );
    }

    if (RESERVED_RECORD_KEYS.has(normalizeRef(key))) {
        throw new TypeError(
            `hiddenMetadataKey "${key}" clashes with a reserved record key.`
        );
    }

    return key;
}

function removeInstalledMetadata(target: object): void {
    const previousKey = installedMetadataKeys.get(target);
    if (!previousKey) return;

    const descriptor = Object.getOwnPropertyDescriptor(target, previousKey);
    if (descriptor?.configurable) {
        Reflect.deleteProperty(target, previousKey);
    }

    installedMetadataKeys.delete(target);
}

function defineHiddenMetadata(
    target: unknown,
    key: string | null,
    type: RemoteHiddenMetadataType,
    parent: () => unknown,
): void {
    if ((typeof target !== 'object' || target === null) && typeof target !== 'function') {
        return;
    }

    const objectTarget = target as object;
    const previousKey = installedMetadataKeys.get(objectTarget);

    if (previousKey && previousKey !== key) {
        removeInstalledMetadata(objectTarget);
    }

    if (!key) {
        removeInstalledMetadata(objectTarget);
        return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(objectTarget, key);
    if (descriptor && installedMetadataKeys.get(objectTarget) !== key) {
        throw new TypeError(
            `hiddenMetadataKey "${key}" clashes with an existing property.`
        );
    }

    const metadata = { type } as {
        type: RemoteHiddenMetadataType;
        readonly parent: unknown;
    };

    Object.defineProperty(metadata, 'parent', {
        enumerable: true,
        configurable: false,
        get: parent,
    });

    Object.defineProperty(objectTarget, key, {
        enumerable: false,
        configurable: true,
        writable: false,
        value: metadata,
    });

    installedMetadataKeys.set(objectTarget, key);
}

function getRawLinkedValue(
    values: object,
    fieldKey: string,
): unknown {
    return rawLinkedCellValues.get(values)?.get(fieldKey);
}

function restoreLinkedValue(
    values: Record<string, unknown>,
    fieldKey: string,
): void {
    const rawByField = rawLinkedCellValues.get(values);
    if (!rawByField?.has(fieldKey)) return;

    const raw = rawByField.get(fieldKey);

    Object.defineProperty(values, fieldKey, {
        enumerable: true,
        configurable: true,
        writable: true,
        value: raw,
    });

    rawByField.delete(fieldKey);
    if (!rawByField.size) rawLinkedCellValues.delete(values);
}

function installLinkedValueGetter(
    values: Record<string, unknown>,
    fieldKey: string,
    field: RemoteFieldSchema,
    targetTable: RemoteTable,
    metadataKey: string | null,
): void {
    let rawByField = rawLinkedCellValues.get(values);

    if (!rawByField) {
        rawByField = new Map();
        rawLinkedCellValues.set(values, rawByField);
    }

    let raw = rawByField.get(fieldKey);

    if (!rawByField.has(fieldKey)) {
        raw = values[fieldKey];
        rawByField.set(fieldKey, raw);
    }

    if (!Array.isArray(raw)) {
        restoreLinkedValue(values, fieldKey);
        return;
    }

    defineHiddenMetadata(raw, metadataKey, 'cellValue', () => field);

    const refs = new Map<string, RemoteLinkedRecordRef>();

    const linkedRecords = new Proxy(raw, {
        get(target, property, receiver) {
            if (
                typeof property === 'string' &&
                /^(?:0|[1-9]\d*)$/.test(property)
            ) {
                const recordId = Reflect.get(target, property, receiver);

                if (typeof recordId !== 'string') {
                    return recordId;
                }

                let ref = refs.get(property);

                if (!ref) {
                    ref = {} as RemoteLinkedRecordRef;

                    Object.defineProperties(ref, {
                        id: {
                            enumerable: true,
                            configurable: false,
                            get: () => {
                                const value = Reflect.get(target, property, receiver);
                                return typeof value === 'string'
                                    ? value
                                    : String(value ?? '');
                            },
                        },
                        record: {
                            enumerable: false,
                            configurable: false,
                            get: () => targetTable.record(
                                String(Reflect.get(target, property, receiver) ?? '')
                            ),
                        },
                    });

                    refs.set(property, ref);
                }

                return ref;
            }

            return Reflect.get(target, property, receiver);
        },
    });

    Object.defineProperty(values, fieldKey, {
        enumerable: true,
        configurable: true,
        get: () => linkedRecords,
    });
}

function decorateCellObject(
    value: unknown,
    metadataKey: string | null,
    type: 'cellValue' | 'cellStringValue',
    field: RemoteFieldSchema,
): void {
    if ((typeof value !== 'object' || value === null) && typeof value !== 'function') {
        return;
    }

    defineHiddenMetadata(value, metadataKey, type, () => field);
}

function decorateFullData(
    base: RemoteBase,
    tables: RemoteTableRegistry,
    recordsByTable: Map<RemoteTable, RemoteRecord[]>,
    {
        followRecordLinks,
        metadataKey,
    }: {
        followRecordLinks: boolean;
        metadataKey: string | null;
    },
): void {
    defineHiddenMetadata(base, metadataKey, 'base', () => undefined);

    for (const table of tables) {
        defineHiddenMetadata(table, metadataKey, 'table', () => base);

        for (const view of table.views ?? []) {
            defineHiddenMetadata(view, metadataKey, 'view', () => table);
        }

        for (const field of table.fields) {
            defineHiddenMetadata(field, metadataKey, 'field', () => table);

            if (field.options && typeof field.options === 'object') {
                defineHiddenMetadata(
                    field.options,
                    metadataKey,
                    'fieldOptions',
                    () => field,
                );
            }
        }

        const records = recordsByTable.get(table) ?? [];

        for (const record of records) {
            defineHiddenMetadata(record, metadataKey, 'record', () => table);

            for (const field of table.fields) {
                const fieldKey = normalizeRef(field.id);
                const values = record.field.values;
                const linkedTableId = typeof field.options?.linkedTableId === 'string'
                    ? field.options.linkedTableId
                    : undefined;
                const linkedTable = linkedTableId
                    ? tables.get(linkedTableId)
                    : undefined;

                if (followRecordLinks && linkedTable) {
                    installLinkedValueGetter(
                        values,
                        fieldKey,
                        field,
                        linkedTable,
                        metadataKey,
                    );
                } else {
                    restoreLinkedValue(values, fieldKey);
                }

                const rawValue =
                    getRawLinkedValue(values, fieldKey) ??
                    values[fieldKey];

                decorateCellObject(
                    rawValue,
                    metadataKey,
                    'cellValue',
                    field,
                );

                decorateCellObject(
                    record.field.strings[fieldKey],
                    metadataKey,
                    'cellStringValue',
                    field,
                );
            }
        }
    }
}

export function createTableRegistry(tables: RemoteTable[]): RemoteTableRegistry {
    const index = new Map<string, RemoteTable>();

    const defineAlias = (target: RemoteTable[], key: string, table: RemoteTable): void => {
        if (!key || Reflect.has(target, key)) return;
        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: false,
            get: () => table,
        });
    };

    for (const table of tables) {
        index.set(normalizeRef(table.id), table);
        index.set(normalizeRef(table.name), table);
        defineAlias(tables, table.id, table);
        defineAlias(tables, table.name, table);

        const normalizedId = normalizeRef(table.id);
        const normalizedName = normalizeRef(table.name);
        if (normalizedId !== table.id) defineAlias(tables, normalizedId, table);
        if (normalizedName !== table.name) defineAlias(tables, normalizedName, table);
    }

    Object.defineProperty(tables, 'get', {
        configurable: true,
        enumerable: false,
        value: (ref: string) => index.get(normalizeRef(ref)),
    });

    return tables as RemoteTableRegistry;
}

function installBaseTableGetters(base: RemoteBase, tables: RemoteTableRegistry): void {
    for (const table of tables) {
        for (const key of [table.id, table.name, normalizeRef(table.id), normalizeRef(table.name)]) {
            if (!key || Reflect.has(base, key)) continue;
            Object.defineProperty(base, key, {
                configurable: true,
                enumerable: false,
                get: () => table,
            });
        }
    }
}

async function updateBase(base: RemoteBase, updates: RemoteBaseUpdate): Promise<RemoteBaseUpdateResult> {
    const result: RemoteBaseUpdateResult = {};

    for (const [tableRef, operation] of Object.entries(updates ?? {})) {
        const table = base.table.get(tableRef);
        if (!table) throw new Error(`Unknown Airtable table: ${tableRef}`);

        const deletes = operation.records.filter(
            record => 'delete' in record && (record.delete === true || typeof record.delete === 'string')
        );
        const upserts = operation.records
            .filter(record => !('delete' in record) || record.delete !== true)
            .filter(record => !('delete' in record) || typeof record.delete !== 'string');

        const deleteIds = new Set(
            deletes.map(record => typeof record.delete === 'string' ? record.delete : record.id)
                .filter((value): value is string => Boolean(value))
        );

        for (const record of upserts) {
            if ('id' in record && record.id && deleteIds.has(record.id)) {
                throw new Error(`${table.name}: ${record.id} cannot be upserted and deleted in one update.`);
            }
        }

        const tableResult = {
            records: [],
            createdRecords: [],
            updatedRecords: [],
            deletedRecords: [],
        } as RemoteBaseUpdateResult[string];

        if (upserts.length) {
            const upserted = await table.upsertRecords(
                upserts as Array<{ id?: string; fields: Record<string, unknown> }>,
                {
                    fieldsToMergeOn: operation.fieldsToMergeOn,
                    typecast: operation.typecast ?? false,
                }
            );
            tableResult.records.push(...upserted.records);
            tableResult.createdRecords.push(...upserted.createdRecords);
            tableResult.updatedRecords.push(...upserted.updatedRecords);
        }

        if (deletes.length) {
            tableResult.deletedRecords.push(...await table.deleteRecords(deletes));
        }

        result[tableRef] = tableResult;
    }

    return result;
}

export function createLinkedBase(
    baseSchema: RemoteBaseSchema,
    tableSchemas: RemoteTableSchema[],
    request: AirtableRequest,
): RemoteBase {
    const tables = createTableRegistry(
        tableSchemas.map(schema => createRemoteTable(baseSchema.id, schema, request))
    );

    const base = {
        ...baseSchema,
        tables,
        table: tables,
        update(updates: RemoteBaseUpdate) {
            return updateBase(base, updates);
        },
        async fetchFullData(options: RemoteFullDataOptions = {}) {
            const {
                followRecordLinks = true,
                hiddenMetadataKey = DEFAULT_HIDDEN_METADATA_KEY,
                refresh = false,
                format = 'values',
            } = options;

            const metadataKey = resolveHiddenMetadataKey(hiddenMetadataKey);
            const effectiveFormat =
                followRecordLinks && format === 'strings'
                    ? 'both'
                    : format;
            const recordsByTable = new Map<RemoteTable, RemoteRecord[]>();

            for (const table of tables) {
                const records = await table.fetchFullRecords({
                    refresh,
                    format: effectiveFormat,
                });
                recordsByTable.set(table, records);
            }

            decorateFullData(base, tables, recordsByTable, {
                followRecordLinks,
                metadataKey,
            });

            return base;
        },
    } as RemoteBase;

    Object.defineProperties(base, {
        link: {
            enumerable: false,
            get: () => Promise.resolve(base),
        },
        data: {
            enumerable: false,
            get: () => base.fetchFullData(),
        },
    });

    installBaseTableGetters(base, tables);
    return base;
}
