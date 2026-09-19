import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteBase } from './class.ts';
import type { RemoteBase } from './types.ts';

const AUTH = 'pat12345678901234567890';
const BASE_ID = 'appExample0000001';
const OTHER_BASE_ID = 'appExample0000002';
const TABLE_ID = 'tblExample0000001';
const RECORD_ID = 'recExample0000001';

const tableSchema = {
    id: TABLE_ID,
    name: 'Tasks',
    primaryFieldId: 'fldName000000001',
    fields: [{
        id: 'fldName000000001',
        name: 'Name',
        type: 'singleLineText',
    }],
};

function jsonResponse(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        headers: {
            get: () => null,
        },
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('remoteBase.init', () => {
    it('lists every accessible base for all and * without fetching schemas', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            expect(url).toMatch(/\/meta\/bases(?:\?offset=.*)?$/);

            return jsonResponse({
                bases: [
                    { id: BASE_ID, name: 'One' },
                    { id: OTHER_BASE_ID, name: 'Two' },
                ],
            });
        });

        vi.stubGlobal('fetch', fetchMock);

        const remoteBase = createRemoteBase();
        const bases = await remoteBase.init({ auth: AUTH, bases: 'all' });

        expect(bases.map(base => base.id)).toEqual([
            BASE_ID,
            OTHER_BASE_ID,
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('loads schemas for every accessible base for all* and **', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith('/meta/bases')) {
                return jsonResponse({
                    bases: [{ id: BASE_ID, name: 'One' }],
                });
            }

            if (url.includes(`/meta/bases/${BASE_ID}/tables`)) {
                return jsonResponse({ tables: [tableSchema] });
            }

            throw new Error(`Unexpected request: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        const remoteBase = createRemoteBase();
        const bases = await remoteBase.init({ auth: AUTH, bases: 'all*' });
        const base = bases[0] as RemoteBase;

        expect(base.id).toBe(BASE_ID);
        expect(base.table.get(TABLE_ID)?.name).toBe('Tasks');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('treats bare IDs as metadata-only and suffixed IDs as schema loads', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith('/meta/bases')) {
                return jsonResponse({
                    bases: [
                        { id: BASE_ID, name: 'One' },
                        { id: OTHER_BASE_ID, name: 'Two' },
                    ],
                });
            }

            if (url.includes(`/meta/bases/${OTHER_BASE_ID}/tables`)) {
                return jsonResponse({ tables: [tableSchema] });
            }

            throw new Error(`Unexpected request: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        const remoteBase = createRemoteBase();
        const bases = await remoteBase.init({
            auth: AUTH,
            bases: [BASE_ID, `${OTHER_BASE_ID}*`],
        });

        expect(bases[0]).toEqual({ id: BASE_ID, name: 'One' });
        expect((bases[1] as RemoteBase).table.get(TABLE_ID)?.name).toBe('Tasks');
    });

    it('forces schema loading when selected records are requested', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith('/meta/bases')) {
                return jsonResponse({
                    bases: [{ id: BASE_ID, name: 'One' }],
                });
            }

            if (url.includes(`/meta/bases/${BASE_ID}/tables`)) {
                return jsonResponse({ tables: [tableSchema] });
            }

            if (
                url.includes(`/${BASE_ID}/${TABLE_ID}?`) &&
                url.includes('filterByFormula=')
            ) {
                return jsonResponse({
                    records: [{
                        id: RECORD_ID,
                        fields: {
                            fldName000000001: 'Alpha',
                        },
                    }],
                });
            }

            throw new Error(`Unexpected request: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        const remoteBase = createRemoteBase();
        const bases = await remoteBase.init({
            auth: AUTH,
            bases: [{
                id: BASE_ID,
                schema: false,
                records: [RECORD_ID],
            }],
        });
        const base = bases[0] as RemoteBase;

        expect(base.table.get(TABLE_ID)?.record(RECORD_ID)?.name).toBe('Alpha');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('ignores schema false when allRecords is true', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith('/meta/bases')) {
                return jsonResponse({
                    bases: [{ id: BASE_ID, name: 'One' }],
                });
            }

            if (url.includes(`/meta/bases/${BASE_ID}/tables`)) {
                return jsonResponse({ tables: [tableSchema] });
            }

            if (url.includes(`/${BASE_ID}/${TABLE_ID}?`)) {
                expect(url).not.toContain('filterByFormula=');

                return jsonResponse({
                    records: [{
                        id: RECORD_ID,
                        fields: {
                            fldName000000001: 'Alpha',
                        },
                    }],
                });
            }

            throw new Error(`Unexpected request: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        const remoteBase = createRemoteBase();
        const bases = await remoteBase.init({
            auth: AUTH,
            bases: [{
                id: BASE_ID,
                allRecords: true,
                schema: false,
            }],
        });
        const base = bases[0] as RemoteBase;

        expect(base.table.get(TABLE_ID)?.record(RECORD_ID)?.name).toBe('Alpha');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });


    it('supports regex selectors, ** full-data loads, all fallback, and strongest-match priority', async () => {
        const schemaBase = 'appr6R1eRXUU29BXC';
        const fullBase = 'app9FSIYtBwYq6A0C';
        const redditBase = 'appReddit00000000';
        const formulaBase = 'appFormula0000000';
        const freelanceBase = 'appFreelance00000';
        const overlapBase = 'appOverlap0000000';
        const mapBase = 'appMaps0000000000';
        const otherBase = 'appOther000000000';

        const available = [
            { id: schemaBase, name: 'Release Catalog' },
            { id: fullBase, name: 'GitHub DevOps' },
            { id: redditBase, name: 'Reddit Watch' },
            { id: formulaBase, name: 'Formula Lab' },
            { id: freelanceBase, name: 'Freelance Jobs' },
            { id: overlapBase, name: 'Reddit Formula Freelance' },
            { id: mapBase, name: 'Maps Archive' },
            { id: otherBase, name: 'Other Base' },
        ];

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.endsWith('/meta/bases')) {
                return jsonResponse({ bases: available });
            }

            const tableMatch = url.match(/\/meta\/bases\/(app\w{14})\/tables$/);
            if (tableMatch) {
                return jsonResponse({ tables: [tableSchema] });
            }

            const recordsMatch = url.match(
                new RegExp(`/(app\\w{14})/${TABLE_ID}\\?`)
            );
            if (recordsMatch) {
                return jsonResponse({
                    records: [{
                        id: RECORD_ID,
                        fields: {
                            fldName000000001: `record-for-${recordsMatch[1]}`,
                        },
                    }],
                });
            }

            throw new Error(`Unexpected request: ${url}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        const remoteBase = createRemoteBase();
        const result = await remoteBase.init({
            auth: AUTH,
            bases: [
                `${schemaBase}*`,
                `${fullBase}**`,
                '(?<name_regex>.*reddit.*)',
                '(?<name_regex>.*formul.*)*',
                '(?<name_regex>.*freelance.*)**',
                '(?<id_regex>app9FS.*)',
                '(?<regex>^.+ap.*)',
                'all',
            ],
        });

        const byId = new Map(result.map(base => [base.id, base]));

        const hasSchema = (id: string) =>
            Boolean((byId.get(id) as RemoteBase | undefined)?.table);
        const hasRecord = (id: string) =>
            Boolean(
                (byId.get(id) as RemoteBase | undefined)
                    ?.table
                    ?.get(TABLE_ID)
                    ?.record(RECORD_ID)
            );

        expect(hasSchema(schemaBase)).toBe(true);
        expect(hasRecord(schemaBase)).toBe(false);

        expect(hasSchema(fullBase)).toBe(true);
        expect(hasRecord(fullBase)).toBe(true);

        expect(hasSchema(redditBase)).toBe(false);
        expect(hasRecord(redditBase)).toBe(false);

        expect(hasSchema(formulaBase)).toBe(true);
        expect(hasRecord(formulaBase)).toBe(false);

        expect(hasSchema(freelanceBase)).toBe(true);
        expect(hasRecord(freelanceBase)).toBe(true);

        expect(hasSchema(overlapBase)).toBe(true);
        expect(hasRecord(overlapBase)).toBe(true);

        expect(hasSchema(mapBase)).toBe(false);
        expect(hasSchema(otherBase)).toBe(false);

        const urls = fetchMock.mock.calls.map(([input]) => String(input));
        const schemaLoads = (id: string) =>
            urls.filter(url => url.includes(`/meta/bases/${id}/tables`)).length;
        const recordLoads = (id: string) =>
            urls.filter(url => url.includes(`/${id}/${TABLE_ID}?`)).length;

        expect(schemaLoads(overlapBase)).toBe(1);
        expect(recordLoads(overlapBase)).toBe(1);
        expect(recordLoads(fullBase)).toBe(1);
        expect(recordLoads(freelanceBase)).toBe(1);
        expect(recordLoads(formulaBase)).toBe(0);
        expect(recordLoads(redditBase)).toBe(0);
    });
});
