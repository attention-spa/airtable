import type { ParsedConnectionArgs, RemoteBaseConfig } from './types.ts';

const BASE_ID_RE = /\b(?<baseId>app\w{14})\b/;
const TABLE_ID_RE = /\b(?<tableId>tbl\w{14})\b/;

export const normalizeRef = (value: unknown): string =>
    String(value).trim().toLowerCase();

export function parseAirtableRefs(value: unknown): { id?: string; table?: string } {
    if (typeof value !== 'string') return {};

    return {
        id: value.match(BASE_ID_RE)?.groups?.baseId,
        table: value.match(TABLE_ID_RE)?.groups?.tableId,
    };
}

export function parseAuth(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;

    const token = value.trim();
    return token.startsWith('pat') && token.length > 17
        ? token
        : undefined;
}

function assignUnique(
    target: ParsedConnectionArgs,
    key: keyof ParsedConnectionArgs,
    value: string | undefined,
    label: string,
): void {
    if (!value) return;

    if (target[key] && target[key] !== value) {
        throw new TypeError(`Conflicting Airtable ${label} values.`);
    }

    target[key] = value;
}

export function parseConfig(value: RemoteBaseConfig): ParsedConnectionArgs {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('remoteBase.config requires an object.');
    }

    const result: ParsedConnectionArgs = {};

    for (const candidate of [value.id, value.app]) {
        if (candidate == null) continue;

        const id = parseAirtableRefs(String(candidate)).id;

        if (!id) {
            throw new TypeError(
                'Airtable base ID must contain app followed by 14 word characters.'
            );
        }

        assignUnique(result, 'id', id, 'base ID');
    }

    if (value.auth != null) {
        const auth = parseAuth(String(value.auth));

        if (!auth) {
            throw new TypeError(
                'Airtable auth must start with "pat" and be longer than 17 characters.'
            );
        }

        result.auth = auth;
    }

    if (!result.id && !result.auth) {
        throw new TypeError('remoteBase.config requires auth, id, or app.');
    }

    return result;
}

export function parseConnectionArgs(
    args: Array<string | RemoteBaseConfig>,
): ParsedConnectionArgs {
    const result: ParsedConnectionArgs = {};

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

        const auth = parseAuth(value);

        if (auth) {
            assignUnique(result, 'auth', auth, 'auth token');
            continue;
        }

        const refs = parseAirtableRefs(value);
        assignUnique(result, 'id', refs.id, 'base ID');
        assignUnique(result, 'table', refs.table, 'table ID');

        if (refs.id || refs.table) continue;

        throw new TypeError(`Unrecognized remoteBase argument: ${value}`);
    }

    return result;
}
