import { normalizeRef } from './config.ts';
import { chunk } from './request.ts';
import type {
    AirtableRequest,
    DeletedRecord,
    DeleteInput,
    RemoteFieldSchema,
    RemoteRecord,
    RemoteTable,
    RemoteTableSchema,
    UpsertInput,
    UpsertOptions,
    UpsertResult,
} from './types.ts';

type RecordsResponse = {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
    offset?: string;
    createdRecords?: string[];
    updatedRecords?: string[];
};

type DeleteResponse = { records: DeletedRecord[] };

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
    const cache: {
        loaded: boolean;
        loading: Promise<RemoteRecord[]> | null;
        records: RemoteRecord[];
    } = {
        loaded: false,
        loading: null,
        records: [],
    };

    function resolveField(ref: string): RemoteFieldSchema | undefined {
        const key = normalizeRef(ref);
        return fieldsById.get(key) ?? fieldsByName.get(key);
    }

    function normalizeFields(
        fields: Record<string, unknown> = {},
    ): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(fields).map(([key, value]) => [
                fieldsById.get(normalizeRef(key))?.name ?? key,
                value,
            ])
        );
    }

    function normalizeRecord(
        record: { id: string; fields: Record<string, unknown> },
    ): RemoteRecord {
        const fields = normalizeFields(record.fields);
        const primaryValue =
            record.fields?.[schema.primaryFieldId] ??
            fields[primaryField?.name ?? ''];

        return {
            id: record.id,
            name: String(primaryValue ?? ''),
            fields,
        };
    }

    function mergeCache(records: RemoteRecord[]): void {
        if (!cache.loaded) return;

        const byId = new Map(cache.records.map(record => [record.id, record]));
        for (const record of records) byId.set(record.id, record);
        cache.records = [...byId.values()];
    }

    async function fetchFullRecords(
        { refresh = false }: { refresh?: boolean } = {},
    ): Promise<RemoteRecord[]> {
        if (cache.loading) return cache.loading;
        if (cache.loaded && !refresh) return cache.records;

        cache.loading = (async () => {
            const records: RemoteRecord[] = [];
            let offset: string | undefined;

            do {
                const params = new URLSearchParams({
                    pageSize: '100',
                    returnFieldsByFieldId: 'true',
                });
                if (offset) params.set('offset', offset);

                const page = await request<RecordsResponse>(
                    `/${encodeURIComponent(baseId)}/${encodeURIComponent(schema.id)}?${params}`
                );
                records.push(...page.records.map(normalizeRecord));
                offset = page.offset;
            } while (offset);

            cache.records = records;
            cache.loaded = true;
            return cache.records;
        })();

        try {
            return await cache.loading;
        } finally {
            cache.loading = null;
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

        if (cache.loaded) {
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

            const normalized = response.records.map(normalizeRecord);
            result.records.push(...normalized);
            result.createdRecords.push(...(response.createdRecords ?? []));
            result.updatedRecords.push(...(response.updatedRecords ?? []));
            mergeCache(normalized);
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
            return cache.loaded
                ? cache.records.find(record => record.id === id)
                : undefined;
        },
    } as RemoteTable;

    Object.defineProperty(table, 'records', {
        enumerable: true,
        get: () => cache.loaded ? cache.records : fetchFullRecords(),
    });

    return table;
}
