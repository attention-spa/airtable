import { describe, expect, it, vi } from 'vitest';
import { createRemoteTable } from './table.ts';
import type { AirtableRequest, RemoteTableSchema } from './types.ts';

const schema: RemoteTableSchema = {
    id: 'tblExample0000001',
    name: 'Tasks',
    primaryFieldId: 'fldName000000001',
    fields: [
        {
            id: 'fldName000000001',
            name: 'Name',
            type: 'singleLineText',
        },
        {
            id: 'fldCount00000001',
            name: 'Count',
            type: 'number',
        },
    ],
};

describe('remote-base record field reads', () => {
    it('stores values by normalized field ID and proxies fields by name or ID', async () => {
        const request = vi.fn(async (path: string) => {
            expect(path).not.toContain('cellFormat=string');

            return {
                records: [{
                    id: 'recExample0000001',
                    fields: {
                        fldName000000001: 'Alpha',
                        fldCount00000001: 2,
                    },
                }],
            };
        }) as unknown as AirtableRequest;

        const table = createRemoteTable('appExample0000001', schema, request);
        const [record] = await table.fetchFullRecords();

        expect(record.field.values).toEqual({
            fldname000000001: 'Alpha',
            fldcount00000001: 2,
        });
        expect(record.field.strings).toEqual({});

        expect(record.fields.Name).toBe('Alpha');
        expect(record.fields.name).toBe('Alpha');
        expect(record.fields.FLDNAME000000001).toBe('Alpha');
        expect(record.fields.Count).toBe(2);
        expect(record.fields.count).toBe(2);
        expect(Object.keys(record.fields)).toEqual(['Name', 'Count']);
        expect(record.name).toBe('Alpha');
    });

    it('loads string-formatted cells explicitly without changing fields proxy semantics', async () => {
        const request = vi.fn(async (path: string) => {
            if (path.includes('cellFormat=string')) {
                return {
                    records: [{
                        id: 'recExample0000001',
                        fields: {
                            fldName000000001: 'Alpha',
                            fldCount00000001: '2',
                        },
                    }],
                };
            }

            return {
                records: [{
                    id: 'recExample0000001',
                    fields: {
                        fldName000000001: 'Alpha',
                        fldCount00000001: 2,
                    },
                }],
            };
        }) as unknown as AirtableRequest;

        const table = createRemoteTable('appExample0000001', schema, request);
        const [record] = await table.fetchFullRecords();

        await table.fetchFullRecords({ format: 'strings' });

        expect(record.field.values.fldcount00000001).toBe(2);
        expect(record.field.strings).toEqual({
            fldname000000001: 'Alpha',
            fldcount00000001: '2',
        });
        expect(record.fields.Count).toBe(2);
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('can explicitly load both read formats', async () => {
        const request = vi.fn(async (path: string) => ({
            records: [{
                id: 'recExample0000001',
                fields: path.includes('cellFormat=string')
                    ? {
                        fldName000000001: 'Alpha',
                        fldCount00000001: '2',
                    }
                    : {
                        fldName000000001: 'Alpha',
                        fldCount00000001: 2,
                    },
            }],
        })) as unknown as AirtableRequest;

        const table = createRemoteTable('appExample0000001', schema, request);
        const [record] = await table.fetchFullRecords({ format: 'both' });

        expect(record.field.values.fldcount00000001).toBe(2);
        expect(record.field.strings.fldcount00000001).toBe('2');
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('can fetch selected record IDs without marking the whole table loaded', async () => {
        const request = vi.fn(async (path: string) => {
            expect(path).toContain('filterByFormula=');

            return {
                records: [{
                    id: 'recExample0000001',
                    fields: {
                        fldName000000001: 'Alpha',
                        fldCount00000001: 2,
                    },
                }],
            };
        }) as unknown as AirtableRequest;

        const table = createRemoteTable('appExample0000001', schema, request);
        const records = await table.fetchRecords(['recExample0000001']);

        expect(records).toHaveLength(1);
        expect(records[0].id).toBe('recExample0000001');
        expect(table.record('recExample0000001')).toBe(records[0]);
        expect(request).toHaveBeenCalledTimes(1);

        await table.records;
        expect(request).toHaveBeenCalledTimes(2);
    });
});
