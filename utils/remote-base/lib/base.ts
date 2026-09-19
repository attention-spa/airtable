import { normalizeRef } from './config.ts';
import { createRemoteTable } from './table.ts';
import type {
    AirtableRequest,
    RemoteBase,
    RemoteBaseSchema,
    RemoteBaseUpdate,
    RemoteBaseUpdateResult,
    RemoteTable,
    RemoteTableRegistry,
    RemoteTableSchema,
} from './types.ts';

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
        async fetchFullData(options = {}) {
            for (const table of tables) {
                await table.fetchFullRecords(options);
            }
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
