import { describe, expect, it, vi } from 'vitest';
import { createLinkedBase } from './base.ts';
import type {
    AirtableRequest,
    RemoteTableSchema,
} from './types.ts';

const peopleTable: RemoteTableSchema = {
    id: 'tblPeople',
    name: 'People',
    primaryFieldId: 'fldPersonName',
    fields: [
        {
            id: 'fldPersonName',
            name: 'Name',
            type: 'singleLineText',
        },
    ],
    views: [{
        id: 'viwPeople',
        name: 'Grid view',
        type: 'grid',
    }],
};

const tasksTable: RemoteTableSchema = {
    id: 'tblTasks',
    name: 'Tasks',
    primaryFieldId: 'fldTaskName',
    fields: [
        {
            id: 'fldTaskName',
            name: 'Name',
            type: 'singleLineText',
        },
        {
            id: 'fldAssignees',
            name: 'Assignees',
            type: 'multipleRecordLinks',
            options: {
                linkedTableId: 'tblPeople',
            },
        },
    ],
    views: [{
        id: 'viwTasks',
        name: 'Grid view',
        type: 'grid',
    }],
};

function createFixture() {
    const request = vi.fn(async (path: string) => {
        const stringFormat = path.includes('cellFormat=string');

        if (path.includes('tblPeople')) {
            return {
                records: [{
                    id: 'recPerson',
                    fields: stringFormat
                        ? { fldPersonName: 'Ada' }
                        : { fldPersonName: 'Ada' },
                }],
            };
        }

        if (path.includes('tblTasks')) {
            return {
                records: [{
                    id: 'recTask',
                    fields: stringFormat
                        ? {
                            fldTaskName: 'Write tests',
                            fldAssignees: 'Ada',
                        }
                        : {
                            fldTaskName: 'Write tests',
                            fldAssignees: ['recPerson'],
                        },
                }],
            };
        }

        throw new Error(`Unexpected request: ${path}`);
    }) as unknown as AirtableRequest;

    const base = createLinkedBase(
        { id: 'appExample', name: 'Example' },
        [peopleTable, tasksTable],
        request,
    );

    return { base, request };
}

describe('remote-base fetchFullData', () => {
    it('follows record links lazily and installs hidden metadata by default', async () => {
        const { base } = createFixture();

        await base.fetchFullData();

        const people = base.table.get('people')!;
        const tasks = base.table.get('tasks')!;
        const person = people.record('recPerson')!;
        const task = tasks.record('recTask')!;
        const assignees = task.fields.Assignees as unknown[];

        expect(assignees[0]).toBe(person);
        expect(task.field.values.fldassignees).toBe(assignees);
        expect(
            Object.getOwnPropertyDescriptor(
                task.field.values,
                'fldassignees',
            )?.get
        ).toBeTypeOf('function');

        expect(Object.keys(task)).not.toContain('meta');
        expect((task as any).meta.type).toBe('record');
        expect((task as any).meta.parent).toBe(tasks);

        expect((tasks as any).meta.type).toBe('table');
        expect((tasks as any).meta.parent).toBe(base);

        const assigneesField = tasks.field('assignees')!;
        expect((assigneesField as any).meta.type).toBe('field');
        expect((assigneesField as any).meta.parent).toBe(tasks);
        expect((assigneesField.options as any).meta.type).toBe('fieldOptions');
        expect((assigneesField.options as any).meta.parent).toBe(assigneesField);

        expect((tasks.views?.[0] as any).meta.type).toBe('view');
        expect((tasks.views?.[0] as any).meta.parent).toBe(tasks);

        expect((assignees as any).meta.type).toBe('cellValue');
        expect((assignees as any).meta.parent).toBe(assigneesField);

        expect((base as any).meta.type).toBe('base');
        expect((base as any).meta.parent).toBeUndefined();
    });

    it('can disable record-link following and hidden metadata', async () => {
        const { base } = createFixture();

        await base.fetchFullData({
            followRecordLinks: false,
            hiddenMetadataKey: null,
        });

        const tasks = base.table.get('tasks')!;
        const task = tasks.record('recTask')!;

        expect(task.fields.Assignees).toEqual(['recPerson']);
        expect('meta' in task).toBe(false);
        expect('meta' in tasks).toBe(false);
    });

    it('restores raw record IDs when link following is turned off', async () => {
        const { base } = createFixture();

        await base.fetchFullData();
        expect(
            (base.table.get('tasks')!.record('recTask')!.fields.Assignees as unknown[])[0]
        ).toBe(base.table.get('people')!.record('recPerson'));

        await base.fetchFullData({
            followRecordLinks: false,
            hiddenMetadataKey: false,
        });

        expect(
            base.table.get('tasks')!.record('recTask')!.fields.Assignees
        ).toEqual(['recPerson']);
    });

    it('supports a custom hidden metadata key', async () => {
        const { base } = createFixture();

        await base.fetchFullData({
            hiddenMetadataKey: 'context',
        });

        const task = base.table.get('tasks')!.record('recTask')!;

        expect((task as any).context.type).toBe('record');
        expect(Object.keys(task)).not.toContain('context');
        expect('meta' in task).toBe(false);
    });

    it('rejects metadata keys that clash with reserved record keys before fetching', async () => {
        const { base, request } = createFixture();

        await expect(
            base.fetchFullData({ hiddenMetadataKey: 'fields' })
        ).rejects.toThrow('reserved record key');

        expect(request).not.toHaveBeenCalled();
    });

    it('loads values as well when string format is requested with link following', async () => {
        const { base, request } = createFixture();

        await base.fetchFullData({ format: 'strings' });

        const task = base.table.get('tasks')!.record('recTask')!;
        const person = base.table.get('people')!.record('recPerson')!;

        expect((task.fields.Assignees as unknown[])[0]).toBe(person);
        expect(task.field.strings.fldassignees).toBe('Ada');
        expect(request).toHaveBeenCalledTimes(4);
    });
});
