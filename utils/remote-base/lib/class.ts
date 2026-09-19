import { createLinkedBase } from './base.ts';
import {
    normalizeRef,
    parseAirtableRefs,
    parseAuth,
    parseConfig,
    parseConnectionArgs,
} from './config.ts';
import { createRequest } from './request.ts';
import type {
    DeferredRemoteTable,
    RemoteBase,
    RemoteBaseCallable,
    RemoteBaseConfig,
    RemoteBaseHandle,
    RemoteBaseInitBase,
    RemoteBaseInitBaseOptions,
    RemoteBaseInitOptions,
    RemoteBaseInitResult,
    RemoteBaseSchema,
    RemoteBaseState,
    RemoteTable,
    RemoteTableSchema,
} from './types.ts';

type TablesMetadataResponse = { tables: RemoteTableSchema[] };
type BasesMetadataResponse = {
    bases: RemoteBaseSchema[];
    offset?: string;
};

type NormalizedInitBase = {
    id: string;
    schema: boolean;
    fullData: boolean;
    records: string[];
};

export function createRemoteBase(): RemoteBaseCallable {
    const states = new Map<string, RemoteBaseState>();
    let auth: string | undefined;
    let baseListCache: {
        auth: string;
        bases: RemoteBaseSchema[];
    } | null = null;
    const request = createRequest(() => auth);

    function link(
        state: RemoteBaseState,
        knownSchema?: RemoteBaseSchema,
    ): Promise<RemoteBase> {
        if (state.base) return Promise.resolve(state.base);
        if (state.linking) return state.linking;

        state.linking = (async () => {
            const [baseSchema, tableSchema] = await Promise.all([
                knownSchema
                    ? Promise.resolve(knownSchema)
                    : resolveBaseMetadata(state.baseId),
                request<TablesMetadataResponse>(
                    `/meta/bases/${encodeURIComponent(state.baseId)}/tables`
                ),
            ]);

            const base = createLinkedBase(baseSchema, tableSchema.tables, request);
            state.base = base;

            Object.defineProperty(connect, state.baseId, {
                configurable: true,
                enumerable: true,
                value: base,
            });

            if (base.id !== state.baseId) {
                Object.defineProperty(connect, base.id, {
                    configurable: true,
                    enumerable: true,
                    value: base,
                });
            }

            return base;
        })();

        state.linking.catch(() => {
            state.linking = null;
        });

        return state.linking;
    }

    function resolveTable(state: RemoteBaseState, ref: PropertyKey): Promise<RemoteTable> {
        return link(state).then(base => {
            const table = base.table.get(String(ref));
            if (!table) throw new Error(`Unknown Airtable table: ${String(ref)}`);
            return table;
        });
    }

    function createDeferredTable(
        state: RemoteBaseState,
        ref: PropertyKey,
    ): DeferredRemoteTable {
        const target = Promise.resolve() as Promise<void>;
        const methods = new Set([
            'fetchFullRecords',
            'fetchRecords',
            'deleteRecords',
            'upsertRecords',
            'field',
            'record',
        ]);

        return new Proxy(target, {
            get(promise, property, receiver) {
                if (property === 'then' || property === 'catch' || property === 'finally') {
                    const resolved = resolveTable(state, ref);
                    return Reflect.get(resolved, property).bind(resolved);
                }

                if (property === 'records') {
                    return resolveTable(state, ref).then(table => table.records);
                }

                if (methods.has(String(property))) {
                    return (...args: unknown[]) => resolveTable(state, ref)
                        .then(table => (table[property as keyof RemoteTable] as (...args: unknown[]) => unknown)(...args));
                }

                if (typeof property === 'symbol' || Reflect.has(promise, property)) {
                    return Reflect.get(promise, property, receiver);
                }

                return resolveTable(state, ref)
                    .then(table => table[property as keyof RemoteTable]);
            },
        }) as unknown as DeferredRemoteTable;
    }

    function createDeferredTableRegistry(state: RemoteBaseState): unknown[] {
        return new Proxy([], {
            get(target, property, receiver) {
                if (property === 'get') {
                    return (ref: string) => createDeferredTable(state, ref);
                }

                if (typeof property === 'symbol' || Reflect.has(target, property)) {
                    return Reflect.get(target, property, receiver);
                }

                return createDeferredTable(state, property);
            },
        });
    }

    function createHandle(state: RemoteBaseState): RemoteBaseHandle {
        const target = Promise.resolve() as Promise<void>;
        const deferredTables = createDeferredTableRegistry(state);

        return new Proxy(target, {
            get(promise, property, receiver) {
                if (property === 'link') return link(state);
                if (property === 'data') return link(state).then(base => base.fetchFullData());
                if (property === 'table') return deferredTables;
                if (property === 'tables') return link(state).then(base => base.tables);
                if (property === 'update') {
                    return (updates: Parameters<RemoteBase['update']>[0]) =>
                        link(state).then(base => base.update(updates));
                }
                if (property === 'fetchFullData') {
                    return (options?: Parameters<RemoteBase['fetchFullData']>[0]) =>
                        link(state).then(base => base.fetchFullData(options));
                }

                if (property === 'then' || property === 'catch' || property === 'finally') {
                    const resolved = link(state);
                    return Reflect.get(resolved, property).bind(resolved);
                }

                if (typeof property === 'symbol' || Reflect.has(promise, property)) {
                    return Reflect.get(promise, property, receiver);
                }

                return createDeferredTable(state, property);
            },
        }) as unknown as RemoteBaseHandle;
    }

    function getState(baseId: string): RemoteBaseState {
        const key = normalizeRef(baseId);
        let state = states.get(key);

        if (!state) {
            state = {
                baseId,
                base: null,
                linking: null,
                handle: null,
            };
            state.handle = createHandle(state);
            states.set(key, state);
        }

        return state;
    }

    function connect(...args: Array<string | RemoteBaseConfig>) {
        const parsed = parseConnectionArgs(args);
        if (parsed.auth) auth = parsed.auth;

        if (!parsed.id) {
            if (parsed.auth) return proxy;
            throw new TypeError(
                'remoteBase(...) requires a base ID, auth token, or a URL-like ' +
                'string containing a base ID.'
            );
        }

        const state = getState(parsed.id);

        if (parsed.table) {
            if (state.base) {
                const table = state.base.table.get(parsed.table);
                if (!table) throw new Error(`Unknown Airtable table: ${parsed.table}`);
                return table;
            }
            return createDeferredTable(state, parsed.table);
        }

        return state.base ?? state.handle!;
    }

    function configure(value: RemoteBaseConfig) {
        const parsed = parseConfig(value);
        if (parsed.auth) auth = parsed.auth;
        if (!parsed.id) return proxy;

        const state = getState(parsed.id);
        void link(state).catch(() => {});
        return state.base ?? state.handle!;
    }

    async function listBases(
        refresh = false,
    ): Promise<RemoteBaseSchema[]> {
        if (
            !refresh &&
            auth &&
            baseListCache?.auth === auth
        ) {
            return baseListCache.bases;
        }

        const bases: RemoteBaseSchema[] = [];
        let offset: string | undefined;

        do {
            const suffix = offset
                ? `?${new URLSearchParams({ offset })}`
                : '';
            const page = await request<BasesMetadataResponse>(
                `/meta/bases${suffix}`
            );

            bases.push(...page.bases);
            offset = page.offset;
        } while (offset);

        if (auth) {
            baseListCache = {
                auth,
                bases,
            };
        }

        return bases;
    }

    async function resolveBaseMetadata(
        baseId: string,
    ): Promise<RemoteBaseSchema> {
        const bases = await listBases();
        return bases.find(
            base => normalizeRef(base.id) === normalizeRef(baseId)
        ) ?? { id: baseId };
    }

    function parseBaseId(value: string): string {
        const id = parseAirtableRefs(value).id;
        if (!id) {
            throw new TypeError(
                `Invalid Airtable base reference: ${value}`
            );
        }
        return id;
    }

    function normalizeInitBase(
        value: RemoteBaseInitBase,
    ): NormalizedInitBase {
        if (typeof value === 'string') {
            const source = value.trim();
            const withSchema = source.endsWith('*');
            const raw = withSchema ? source.slice(0, -1) : source;

            return {
                id: parseBaseId(raw),
                schema: withSchema,
                fullData: false,
                records: [],
            };
        }

        const option = value as RemoteBaseInitBaseOptions;
        const fullData = Boolean(option.fullData || option.allRecords);
        const records = [
            ...new Set(
                (option.records ?? [])
                    .map(recordId => String(recordId).trim())
                    .filter(Boolean)
            ),
        ];

        for (const recordId of records) {
            if (!/^rec\w{14}$/i.test(recordId)) {
                throw new TypeError(
                    `Invalid Airtable record ID: ${recordId}`
                );
            }
        }

        return {
            id: parseBaseId(option.id),
            schema: fullData || records.length > 0
                ? true
                : option.schema ?? true,
            fullData,
            records,
        };
    }

    function normalizeInitBases(
        values: RemoteBaseInitBase[],
    ): NormalizedInitBase[] {
        const normalized = new Map<string, NormalizedInitBase>();

        for (const value of values) {
            const next = normalizeInitBase(value);
            const key = normalizeRef(next.id);
            const current = normalized.get(key);

            if (!current) {
                normalized.set(key, next);
                continue;
            }

            current.schema ||= next.schema;
            current.fullData ||= next.fullData;
            current.records = [
                ...new Set([...current.records, ...next.records]),
            ];

            if (current.fullData || current.records.length) {
                current.schema = true;
            }
        }

        return [...normalized.values()];
    }

    async function fetchSelectedRecords(
        base: RemoteBase,
        recordIds: string[],
    ): Promise<void> {
        const remaining = new Set(recordIds);

        for (const table of base.tables) {
            if (!remaining.size) break;

            const records = await table.fetchRecords([...remaining]);

            for (const record of records) {
                remaining.delete(record.id);
            }
        }
    }

    async function initialize(
        options: RemoteBaseInitOptions,
    ): Promise<RemoteBaseInitResult> {
        const nextAuth = parseAuth(options?.auth);

        if (!nextAuth) {
            throw new TypeError(
                'remoteBase.init requires a valid Airtable PAT in auth.'
            );
        }

        auth = nextAuth;
        const selection = options.bases ?? 'all';

        if (
            selection === 'all' ||
            selection === '*' ||
            selection === 'all*' ||
            selection === '**'
        ) {
            const bases = await listBases(true);

            if (selection === 'all' || selection === '*') {
                return bases;
            }

            const loaded: RemoteBase[] = [];

            for (const baseSchema of bases) {
                loaded.push(
                    await link(getState(baseSchema.id), baseSchema)
                );
            }

            return loaded;
        }

        if (!Array.isArray(selection)) {
            throw new TypeError(
                'remoteBase.init bases must be all, *, all*, **, or an array.'
            );
        }

        const result: RemoteBaseInitResult = [];
        const normalized = normalizeInitBases(selection);
        const availableBases = await listBases(true);
        const metadataById = new Map(
            availableBases.map(base => [normalizeRef(base.id), base])
        );

        for (const item of normalized) {
            const listedMetadata = metadataById.get(normalizeRef(item.id));

            if (!listedMetadata) {
                throw new Error(
                    `Airtable base is not accessible to this token: ${item.id}`
                );
            }

            if (!item.schema) {
                result.push(listedMetadata);
                continue;
            }

            const base = await link(
                getState(item.id),
                listedMetadata,
            );

            if (item.fullData) {
                await base.fetchFullData();
            } else if (item.records.length) {
                await fetchSelectedRecords(base, item.records);
            }

            result.push(base);
        }

        return result;
    }

    Object.defineProperty(connect, 'auth', {
        configurable: false,
        enumerable: true,
        get: () => auth,
        set: value => {
            if (value == null || value === '') {
                auth = undefined;
                return;
            }

            const nextAuth = parseAuth(String(value));
            if (!nextAuth) {
                throw new TypeError(
                    'Airtable auth must start with "pat" and be longer than 17 characters.'
                );
            }
            auth = nextAuth;
        },
    });

    Object.defineProperty(connect, 'config', {
        configurable: false,
        enumerable: true,
        get: () => configure,
        set: configure,
    });

    Object.defineProperty(connect, 'init', {
        configurable: false,
        enumerable: true,
        writable: false,
        value: initialize,
    });

    const proxy = new Proxy(connect, {
        get(target, property, receiver) {
            if (typeof property === 'string' && /^app\w{14}$/i.test(property)) {
                const base = states.get(normalizeRef(property))?.base;
                if (base) return base;
            }
            return Reflect.get(target, property, receiver);
        },
        has(target, property) {
            if (
                typeof property === 'string' &&
                /^app\w{14}$/i.test(property) &&
                states.get(normalizeRef(property))?.base
            ) {
                return true;
            }
            return Reflect.has(target, property);
        },
    }) as RemoteBaseCallable;

    return proxy;
}

export const remoteBase = createRemoteBase();
