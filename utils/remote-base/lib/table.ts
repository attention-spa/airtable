import { normalizeRef } from './config.ts';
import { chunk } from './request.ts';
import type {
    AirtableRecordFields,
    AirtableRecordStrings,
    AirtableRequest,
    DeletedRecord,
    DeleteInput,
    RemoteFieldSchema,
    RemoteReadFormat,
    RemoteReadOptions,
    RemoteRecord,
    RemoteRecordFieldData,
    RemoteTable,
    RemoteTableSchema,
    UpsertInput,
    UpsertOptions,
    UpsertResult,
} from './types.ts';

type RawRecord = {
    id: string;
    fields: Record<string, unknown>;
};

type RecordsResponse = {
    records: RawRecord[];
    offset?: string;
    createdRecords?: string[];
    updatedRecords?: string[];
};

type DeleteResponse = { records: DeletedRecord[] };
type LoadedReadFormat = Exclude<RemoteReadFormat, 'both'>;

const hasOwn = (target: object, key: PropertyKey): boolean =>
    Object.prototype.hasOwnProperty.call(target, key);

export function createRemoteTable(
    baseId: string,
    schema: RemoteTableSchema,
    request: AirtableRequest,
): RemoteTable {
    const fieldsById = new Map(
        schema.fields.map(field => [normalizeRef(field.id), field])
    );
    const fieldsByName = new Map(
        schema.fields.map(field => [normalizeRef(field.name), field])
    );
    const primaryField = fieldsById.get(normalizeRef(schema.primaryFieldId));
    const primaryFieldKey = primaryField
        ? normalizeRef(primaryField.id)
        : normalizeRef(schema.primaryFieldId);

    const cache: {
        loaded: Record<LoadedReadFormat, boolean>;
        loading: Record<LoadedReadFormat, Promise<RemoteRecord[]> | null>;
        records: RemoteRecord[];
    } = {
        loaded: {
            values: false,
            strings: false,
        },
        loading: {
            values: null,
            strings: null,
        },
        records: [],
    };

    function resolveField(ref: string): RemoteFieldSchema | undefined {
        const key = normalizeRef(ref);
        return fieldsById.get(key) ?? fieldsByName.get(key);
    }

    function canonicalFieldRef(ref: string): string | undefined {
        const field = resolveField(ref);
        return field ? normalizeRef(field.id) : undefined;
    }

    function normalizeValueFields(
        fields: Record<string, unknown> = {},
    ): AirtableRecordFields {
        return Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
                canonicalFieldRef(key) ?? normalizeRef(key),
                value,
            ])
        );
    }

    function normalizeStringFields(
        fields: Record<string, unknown> = {},
    ): AirtableRecordStrings {
        return Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
                canonicalFieldRef(key) ?? normalizeRef(key),
                typeof value === 'string' ? value : String(value ?? ''),
            ])
        );
    }

    function createFieldsProxy(
        field: RemoteRecordFieldData,
    ): AirtableRecordFields {
        const target = Object.create(null) as AirtableRecordFields;

        return new Proxy(target, {
            get(_, property, receiver) {
                if (typeof property !== 'string') {
                    return Reflect.get(target, property, receiver);
                }

                const ref = canonicalFieldRef(property);
                return ref ? field.values[ref] : undefined;
            },
            has(_, property) {
                if (typeof property !== 'string') return false;
                const ref = canonicalFieldRef(property);
                return Boolean(ref && hasOwn(field.values, ref));
            },
            ownKeys() {
                return schema.fields
                    .filter(fieldSchema =>
                        hasOwn(field.values, normalizeRef(fieldSchema.id))
                    )
                    .map(fieldSchema => fieldSchema.name);
            },
            getOwnPropertyDescriptor(_, property) {
                if (typeof property !== 'string') return undefined;
                const ref = canonicalFieldRef(property);

                if (!ref || !hasOwn(field.values, ref)) {
                    return undefined;
                }

                return {
                    configurable: true,
                    enumerable: true,
                };
            },
        });
    }

    function createRecord(id: string): RemoteRecord {
        const field: RemoteRecordFieldData = {
            values: {},
            strings: {},
        };

        return {
            id,
            name: '',
            field,
            fields: createFieldsProxy(field),
        };
    }

    function refreshRecordName(record: RemoteRecord): void {
        const primaryValue =
            record.field.values[primaryFieldKey] ??
            record.field.strings[primaryFieldKey];

        record.name = String(primaryValue ?? '');
    }

    function normalizeValueRecord(record: RawRecord): RemoteRecord {
        const normalized = createRecord(record.id);
        normalized.field.values = normalizeValueFields(record.fields);
        refreshRecordName(normalized);
        return normalized;
    }

    function applyFullRead(
        format: LoadedReadFormat,
        records: RawRecord[],
    ): RemoteRecord[] {
        const existingById = new Map(
            cache.records.map(record => [record.id, record])
        );

        cache.records = records.map(raw => {
            const record = existingById.get(raw.id) ?? createRecord(raw.id);

            if (format === 'values') {
                record.field.values = normalizeValueFields(raw.fields);
            } else {
                record.field.strings = normalizeStringFields(raw.fields);
            }

            refreshRecordName(record);
            return record;
        });

        cache.loaded[format] = true;
        return cache.records;
    }

    async function fetchFormat(
        format: LoadedReadFormat,
        refresh: boolean,
    ): Promise<RemoteRecord[]> {
        if (cache.loading[format]) return cache.loading[format]!;
        if (cache.loaded[format] && !refresh) return cache.records;

        cache.loading[format] = (async () => {
            const records: RawRecord[] = [];
            let offset: string | undefined;

            do {
                const params = new URLSearchParams({
                    pageSize: '100',
                    returnFieldsByFieldId: 'true',
                });

                if (format === 'strings') {
                    params.set('cellFormat', 'string');
                }

                if (offset) params.set('offset', offset);

                const page = await request<RecordsResponse>(
                    `/${encodeURIComponent(baseId)}/${encodeURIComponent(schema.id)}?${params}`
                );

                records.push(...page.records);
                offset = page.offset;
            } while (offset);

            return applyFullRead(format, records);
        })();

        try {
            return await cache.loading[format]!;
        } finally {
            cache.loading[format] = null;
        }
    }

    async function fetchFullRecords(
        { refresh = false, format = 'values' }: RemoteReadOptions = {},
    ): Promise<RemoteRecord[]> {
        if (format === 'both') {
            await fetchFormat('values', refresh);
            return fetchFormat('strings', refresh);
        }

        return fetchFormat(format, refresh);
    }

    function mergeValueCache(records: RemoteRecord[]): void {
        if (!cache.loaded.values) return;

        const byId = new Map(cache.records.map(record => [record.id, record]));

        for (const next of records) {
            const current = byId.get(next.id);

            if (!current) {
                byId.set(next.id, next);
                continue;
            }

            current.field.values = next.field.values;
            current.field.strings = {};
            refreshRecordName(current);
        }

        cache.records = [...byId.values()];

        if (records.length) {
            cache.loaded.strings = false;
        }
    }

    async function deleteRecords(
        input: DeleteInput | DeleteInput[],
    ): Promise<DeletedRecord[]> {
        const values = Array.isArray(input) ? input : [input];
        const ids = [
            ...new Set(
                values.map(value => {
                    if (typeof value === 'string') return value;
                    if (typeof value.delete === 'string') return value.delete;
                    return value.id;
                }).filter(Boolean)
            ),
        ];

        if (!ids.length) return [];
        const deleted: DeletedRecord[] = [];

        for (const batch of chunk(ids)) {
            const params = new URLSearchParams();
            for (const id of batch) params.append('records[]', id);

            const result = await request<DeleteResponse>(
                `/${encodeURIComponent(baseId)}/${encodeURIComponent(schema.id)}?${params}`,
                { method: 'DELETE' }
            );
            deleted.push(...result.records);
        }

        if (cache.loaded.values || cache.loaded.strings) {
            const deletedIds = new Set(
                deleted.filter(record => record.deleted).map(record => record.id)
            );
            cache.records = cache.records.filter(
                record => !deletedIds.has(record.id)
            );
        }

        return deleted;
    }

    async function upsertRecords(
        input: UpsertInput | UpsertInput[],
        {
            fieldsToMergeOn = primaryField ? [primaryField.name] : [],
            typecast = false,
        }: UpsertOptions = {},
    ): Promise<UpsertResult> {
        const values = Array.isArray(input) ? input : [input];

        if (!values.length) {
            return { records: [], createdRecords: [], updatedRecords: [] };
        }

        const mergeFields = fieldsToMergeOn
            .map(ref => resolveField(ref)?.name ?? ref)
            .filter(Boolean);

        if (values.some(record => !record.id) && !mergeFields.length) {
            throw new Error(
                `${schema.name}: id-less upserts require fieldsToMergeOn.`
            );
        }

        const records = values.map(record => ({
            ...(record.id ? { id: record.id } : {}),
            fields: record.fields,
        }));

        const result: UpsertResult = {
            records: [],
            createdRecords: [],
            updatedRecords: [],
        };

        for (const batch of chunk(records)) {
            const response = await request<RecordsResponse>(
                `/${encodeURIComponent(baseId)}/${encodeURIComponent(schema.id)}`,
                {
                    method: 'PATCH',
                    body: {
                        records: batch,
                        typecast,
                        returnFieldsByFieldId: true,
                        performUpsert: { fieldsToMergeOn: mergeFields },
                    },
                }
            );

            const normalized = response.records.map(normalizeValueRecord);
            result.records.push(...normalized);
            result.createdRecords.push(...(response.createdRecords ?? []));
            result.updatedRecords.push(...(response.updatedRecords ?? []));
            mergeValueCache(normalized);
        }

        return result;
    }

    const table = {
        ...schema,
        fetchFullRecords,
        deleteRecords,
        upsertRecords,
        field: resolveField,
        record(id: string) {
            return cache.records.find(record => record.id === id);
        },
    } as RemoteTable;

    Object.defineProperty(table, 'records', {
        enumerable: true,
        get: () => cache.loaded.values
            ? cache.records
            : fetchFullRecords(),
    });

    return table;
}
