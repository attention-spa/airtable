export function createRemoteBase() {
    const API = 'https://api.airtable.com/v0';
    const states = new Map();
    let auth;

    const BASE_ID_RE = /\b(?<baseId>app\w{14})\b/;
    const TABLE_ID_RE = /\b(?<tableId>tbl\w{14})\b/;
    const norm = value => String(value).trim().toLowerCase();

    function parseAirtableRefs(value) {
        if (typeof value !== 'string') return {};
        return {
            id: value.match(BASE_ID_RE)?.groups?.baseId,
            table: value.match(TABLE_ID_RE)?.groups?.tableId,
        };
    }

    const parseBaseId = value => parseAirtableRefs(value).id;

    function parseAuth(value) {
        if (typeof value !== 'string') return undefined;
        const token = value.trim();
        return token.startsWith('pat') && token.length > 17
            ? token
            : undefined;
    }

    function assignUnique(target, key, value, label) {
        if (!value) return;
        if (target[key] && target[key] !== value) {
            throw new TypeError(`Conflicting Airtable ${label} values.`);
        }
        target[key] = value;
    }

    function parseConfig(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new TypeError('remoteBase.config requires an object.');
        }

        const result = {};
        for (const candidate of [value.id, value.app]) {
            if (candidate == null) continue;
            const id = parseBaseId(String(candidate));
            if (!id) {
                throw new TypeError(
                    'Airtable base ID must contain app followed by 14 word characters.'
                );
            }
            assignUnique(result, 'id', id, 'base ID');
        }

        if (value.auth != null) {
            const nextAuth = parseAuth(String(value.auth));
            if (!nextAuth) {
                throw new TypeError(
                    'Airtable auth must start with "pat" and be longer than 17 characters.'
                );
            }
            result.auth = nextAuth;
        }

        if (!result.id && !result.auth) {
            throw new TypeError('remoteBase.config requires auth, id, or app.');
        }
        return result;
    }

    function parseConnectionArgs(args) {
        const result = {};

        for (const value of args) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const parsed = parseConfig(value);
                assignUnique(result, 'id', parsed.id, 'base ID');
                assignUnique(result, 'auth', parsed.auth, 'auth token');
                continue;
            }

            if (typeof value !== 'string') {
                throw new TypeError(
                    'remoteBase arguments must be strings or config objects.'
                );
            }

            const nextAuth = parseAuth(value);
            if (nextAuth) {
                assignUnique(result, 'auth', nextAuth, 'auth token');
                continue;
            }

            const refs = parseAirtableRefs(value);
            if (refs.id) assignUnique(result, 'id', refs.id, 'base ID');
            if (refs.table) assignUnique(result, 'table', refs.table, 'table ID');
            if (refs.id || refs.table) continue;

            throw new TypeError(`Unrecognized remoteBase argument: ${value}`);
        }

        return result;
    }

    function chunks(values, size = 10) {
        const out = [];
        for (let i = 0; i < values.length; i += size) {
            out.push(values.slice(i, i + size));
        }
        return out;
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function request(path, { method = 'GET', body, retries = 5 } = {}) {
        if (!auth) {
            throw new Error(
                'remoteBase auth is not configured. Use remoteBase.config({ auth }), ' +
                'set remoteBase.auth, or pass the PAT to remoteBase(...).'
            );
        }

        const response = await fetch(`${API}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${auth}`,
                'Content-Type': 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        if (response.status === 429 && retries > 0) {
            const retryAfter = Number(response.headers.get('Retry-After'));
            await sleep(
                (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1) * 1000
            );
            return request(path, { method, body, retries: retries - 1 });
        }

        if (!response.ok) {
            throw new Error(
                `Airtable ${response.status}: ${await response.text()}`
            );
        }

        return response.json();
    }

    function createTable(baseId, schema) {
        const fieldsById = new Map(
            schema.fields.map(field => [norm(field.id), field])
        );
        const fieldsByName = new Map(
            schema.fields.map(field => [norm(field.name), field])
        );
        const primaryField = fieldsById.get(norm(schema.primaryFieldId));
        const cache = { loaded: false, loading: null, records: [] };

        function resolveField(ref) {
            const key = norm(ref);
            return fieldsById.get(key) ?? fieldsByName.get(key);
        }

        function normalizeFields(fields = {}) {
            return Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [
                    fieldsById.get(norm(key))?.name ?? key,
                    value,
                ])
            );
        }

        function normalizeRecord(record) {
            const fields = normalizeFields(record.fields);
            const primaryValue =
                record.fields?.[schema.primaryFieldId] ??
                fields[primaryField?.name];
            return {
                id: record.id,
                name: String(primaryValue ?? ''),
                fields,
            };
        }

        function mergeCache(records) {
            if (!cache.loaded) return;
            const byId = new Map(cache.records.map(record => [record.id, record]));
            for (const record of records) byId.set(record.id, record);
            cache.records = [...byId.values()];
        }

        async function fetchFullRecords({ refresh = false } = {}) {
            if (cache.loading) return cache.loading;
            if (cache.loaded && !refresh) return cache.records;

            cache.loading = (async () => {
                const records = [];
                let offset;

                do {
                    const params = new URLSearchParams({
                        pageSize: '100',
                        returnFieldsByFieldId: 'true',
                    });
                    if (offset) params.set('offset', offset);

                    const page = await request(
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

        async function deleteRecords(input) {
            const values = Array.isArray(input) ? input : [input];
            const ids = [
                ...new Set(
                    values.map(value => {
                        if (typeof value === 'string') return value;
                        if (typeof value?.delete === 'string') return value.delete;
                        return value?.id;
                    }).filter(Boolean)
                ),
            ];

            if (!ids.length) return [];
            const deleted = [];

            for (const batch of chunks(ids)) {
                const params = new URLSearchParams();
                for (const id of batch) params.append('records[]', id);
                const result = await request(
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

        async function upsertRecords(input, {
            fieldsToMergeOn = primaryField ? [primaryField.name] : [],
            typecast = false,
        } = {}) {
            const values = Array.isArray(input) ? input : [input];
            if (!values.length) {
                return { records: [], createdRecords: [], updatedRecords: [] };
            }

            const mergeFields = fieldsToMergeOn
                .map(ref => resolveField(ref)?.name ?? ref)
                .filter(Boolean);

            if (values.some(record => !record?.id) && !mergeFields.length) {
                throw new Error(
                    `${schema.name}: id-less upserts require fieldsToMergeOn.`
                );
            }

            const records = values.map(record => {
                if (!record || typeof record.fields !== 'object' || record.fields === null) {
                    throw new TypeError(
                        `${schema.name}: upsert records require a fields object.`
                    );
                }
                return {
                    ...(record.id ? { id: record.id } : {}),
                    fields: record.fields,
                };
            });

            const result = {
                records: [],
                createdRecords: [],
                updatedRecords: [],
            };

            for (const batch of chunks(records)) {
                const response = await request(
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
            record(id) {
                return cache.loaded
                    ? cache.records.find(record => record.id === id)
                    : undefined;
            },
        };

        Object.defineProperty(table, 'records', {
            enumerable: true,
            get() {
                return cache.loaded ? cache.records : fetchFullRecords();
            },
        });

        return table;
    }

    function createTableRegistry(tables) {
        const index = new Map();

        const defineAlias = (target, key, table) => {
            if (!key || typeof key !== 'string' || Reflect.has(target, key)) return;
            Object.defineProperty(target, key, {
                configurable: true,
                enumerable: false,
                get: () => table,
            });
        };

        for (const table of tables) {
            index.set(norm(table.id), table);
            index.set(norm(table.name), table);
            defineAlias(tables, table.id, table);
            defineAlias(tables, table.name, table);

            const normalizedId = norm(table.id);
            const normalizedName = norm(table.name);
            if (normalizedId !== table.id) defineAlias(tables, normalizedId, table);
            if (normalizedName !== table.name) defineAlias(tables, normalizedName, table);
        }

        Object.defineProperty(tables, 'get', {
            configurable: true,
            enumerable: false,
            value: ref => index.get(norm(ref)),
        });

        return tables;
    }

    function installBaseTableGetters(base, tables) {
        for (const table of tables) {
            for (const key of [
                table.id,
                table.name,
                norm(table.id),
                norm(table.name),
            ]) {
                if (!key || typeof key !== 'string' || Reflect.has(base, key)) continue;
                Object.defineProperty(base, key, {
                    configurable: true,
                    enumerable: false,
                    get: () => table,
                });
            }
        }
        return base;
    }

    async function updateBase(base, updates) {
        const result = {};

        for (const [tableRef, operation] of Object.entries(updates ?? {})) {
            const table = base.table.get(tableRef);
            if (!table) throw new Error(`Unknown Airtable table: ${tableRef}`);

            const input = operation?.records ?? [];
            const deletes = [];
            const upserts = [];

            for (const record of input) {
                if (record?.delete === true || typeof record?.delete === 'string') {
                    deletes.push(record);
                } else {
                    upserts.push(record);
                }
            }

            const deleteIds = new Set(
                deletes.map(record =>
                    typeof record.delete === 'string' ? record.delete : record.id
                ).filter(Boolean)
            );

            for (const record of upserts) {
                if (record?.id && deleteIds.has(record.id)) {
                    throw new Error(
                        `${table.name}: ${record.id} cannot be upserted and deleted in one update.`
                    );
                }
            }

            const tableResult = {
                records: [],
                createdRecords: [],
                updatedRecords: [],
                deletedRecords: [],
            };

            if (upserts.length) {
                const upserted = await table.upsertRecords(upserts, {
                    fieldsToMergeOn: operation.fieldsToMergeOn,
                    typecast: operation.typecast ?? false,
                });
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

    async function link(state) {
        if (state.base) return state.base;
        if (state.linking) return state.linking;

        state.linking = (async () => {
            const [baseSchema, tableSchema] = await Promise.all([
                request(`/meta/bases/${encodeURIComponent(state.baseId)}`),
                request(`/meta/bases/${encodeURIComponent(state.baseId)}/tables`),
            ]);

            const tables = tableSchema.tables.map(
                schema => createTable(state.baseId, schema)
            );
            const table = createTableRegistry(tables);

            const base = {
                ...baseSchema,
                tables,
                table,
                update(updates) {
                    return updateBase(base, updates);
                },
                async fetchFullData({ refresh = false } = {}) {
                    for (const currentTable of tables) {
                        await currentTable.fetchFullRecords({ refresh });
                    }
                    return base;
                },
            };

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
            state.base = base;

            for (const id of new Set([state.baseId, base.id].filter(Boolean))) {
                Object.defineProperty(connect, id, {
                    configurable: true,
                    enumerable: true,
                    value: base,
                });
            }

            return base;
        })();

        try {
            return await state.linking;
        } catch (error) {
            state.linking = null;
            throw error;
        }
    }

    function resolveTable(state, ref) {
        return link(state).then(base => {
            const table = base.table.get(ref);
            if (!table) {
                throw new Error(`Unknown Airtable table: ${String(ref)}`);
            }
            return table;
        });
    }

    function createDeferredTable(state, ref) {
        const target = Promise.resolve();
        const methods = new Set([
            'fetchFullRecords',
            'deleteRecords',
            'upsertRecords',
            'field',
            'record',
        ]);

        return new Proxy(target, {
            get(promise, property, receiver) {
                if (
                    property === 'then' ||
                    property === 'catch' ||
                    property === 'finally'
                ) {
                    const resolved = resolveTable(state, ref);
                    return resolved[property].bind(resolved);
                }

                if (property === 'records') {
                    return resolveTable(state, ref).then(table => table.records);
                }

                if (methods.has(property)) {
                    return (...args) => resolveTable(state, ref)
                        .then(table => table[property](...args));
                }

                if (typeof property === 'symbol' || Reflect.has(promise, property)) {
                    return Reflect.get(promise, property, receiver);
                }

                return resolveTable(state, ref).then(table => table[property]);
            },
        });
    }

    function createDeferredTableProxy(state) {
        return new Proxy([], {
            get(target, property, receiver) {
                if (property === 'get') {
                    return ref => createDeferredTable(state, ref);
                }
                if (typeof property === 'symbol' || Reflect.has(target, property)) {
                    return Reflect.get(target, property, receiver);
                }
                return createDeferredTable(state, property);
            },
        });
    }

    function createHandle(state) {
        const target = Promise.resolve();
        const deferredTables = createDeferredTableProxy(state);

        return new Proxy(target, {
            get(promise, property, receiver) {
                if (property === 'link') return link(state);
                if (property === 'data') {
                    return link(state).then(base => base.fetchFullData());
                }
                if (property === 'table') return deferredTables;
                if (property === 'tables') return link(state).then(base => base.tables);
                if (property === 'update') {
                    return updates => link(state).then(base => base.update(updates));
                }
                if (property === 'fetchFullData') {
                    return options => link(state)
                        .then(base => base.fetchFullData(options));
                }

                if (
                    property === 'then' ||
                    property === 'catch' ||
                    property === 'finally'
                ) {
                    const resolved = link(state);
                    return resolved[property].bind(resolved);
                }

                if (typeof property === 'symbol' || Reflect.has(promise, property)) {
                    return Reflect.get(promise, property, receiver);
                }

                return createDeferredTable(state, property);
            },
        });
    }

    function getState(baseId) {
        const key = norm(baseId);
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

    function connect(...args) {
        const parsed = parseConnectionArgs(args);
        if (parsed.auth) auth = parsed.auth;

        if (!parsed.id) {
            if (parsed.auth) return connect;
            throw new TypeError(
                'remoteBase(...) requires a base ID, auth token, or a URL-like ' +
                'string containing a base ID.'
            );
        }

        const state = getState(parsed.id);

        if (parsed.table) {
            if (state.base) {
                const table = state.base.table.get(parsed.table);
                if (!table) {
                    throw new Error(`Unknown Airtable table: ${parsed.table}`);
                }
                return table;
            }
            return createDeferredTable(state, parsed.table);
        }

        return state.base ?? state.handle;
    }

    function configure(value) {
        const parsed = parseConfig(value);
        if (parsed.auth) auth = parsed.auth;
        if (!parsed.id) return connect;

        const state = getState(parsed.id);
        void link(state).catch(() => {});
        return state.base ?? state.handle;
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

    return new Proxy(connect, {
        get(target, property, receiver) {
            if (typeof property === 'string' && /^app\w{14}$/i.test(property)) {
                const base = states.get(norm(property))?.base;
                if (base) return base;
            }
            return Reflect.get(target, property, receiver);
        },
        has(target, property) {
            if (
                typeof property === 'string' &&
                /^app\w{14}$/i.test(property) &&
                states.get(norm(property))?.base
            ) {
                return true;
            }
            return Reflect.has(target, property);
        },
    });
}
