import { chunk } from '../../core/batching.ts';
import type { AirtableRequest } from './types.ts';

export { chunk };

const API = 'https://api.airtable.com/v0';
const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

export function createRequest(getAuth: () => string | undefined): AirtableRequest {
    return async function request<T = unknown>(
        path: string,
        options: { method?: string; body?: unknown; retries?: number } = {},
    ): Promise<T> {
        const { method = 'GET', body, retries = 5 } = options;
        const auth = getAuth();

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
            return request<T>(path, { method, body, retries: retries - 1 });
        }

        if (!response.ok) {
            throw new Error(
                `Airtable ${response.status}: ${await response.text()}`
            );
        }

        return response.json() as Promise<T>;
    };
}
