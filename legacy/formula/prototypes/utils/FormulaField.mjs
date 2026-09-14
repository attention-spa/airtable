/// <reference lib="WebWorker"/>
/// <reference lib="ESNext"/>

export class FormulaField {
    constructor(token, options = {}) {
        assertNonEmptyString(token, "token");

        this.token = token;
        this.endpoint = options.endpoint ?? "https://api.airtable.com/v0";
        this.fetch = options.fetchLib ?? globalThis.fetch;

        if (typeof this.fetch !== "function") {
            throw new TypeError("FormulaField requires a fetch implementation.");
        }
    }

    /**
     * Creates a formula field.
     *
     * @param {string} path - "baseId/tableNameOrId/fieldName"
     * @param {string} formulaCode - Airtable formula expression.
     * @returns {Promise<object>} Created field schema.
     */
    async createFormulaField(path, formulaCode) {
        assertNonEmptyString(formulaCode, "formulaCode");

        const { baseId, tableRef, fieldRef } = parseFormulaPath(path);

        if (isAirtableId(fieldRef, "fld")) {
            throw new Error(
                `createFormulaField requires a new field name, not a field ID: ${fieldRef}`
            );
        }

        const schema = await this.getBaseSchema(baseId);
        const table = resolveTable(schema, tableRef);

        const existing = table.fields?.find(
            (field) => field.name === fieldRef || field.id === fieldRef
        );

        if (existing) {
            throw new Error(
                `Cannot create formula field "${fieldRef}" because it already exists as ${existing.id}.`
            );
        }

        return this.request(
            [
                "meta",
                "bases",
                baseId,
                "tables",
                table.id,
                "fields",
            ],
            {
                method: "POST",
                body: {
                    name: fieldRef,
                    type: "formula",
                    options: {
                        formula: formulaCode,
                    },
                },
            }
        );
    }

    /**
     * Updates an existing formula field.
     *
     * @param {string} path - "baseId/tableNameOrId/fieldNameOrId"
     * @param {string} formulaCode - Airtable formula expression.
     * @returns {Promise<object>} Updated field schema.
     */
    async updateFormulaField(path, formulaCode) {
        assertNonEmptyString(formulaCode, "formulaCode");

        const { baseId, tableRef, fieldRef } = parseFormulaPath(path);

        const schema = await this.getBaseSchema(baseId);
        const table = resolveTable(schema, tableRef);
        const field = resolveField(table, fieldRef);

        if (field.type !== "formula") {
            throw new Error(
                `Cannot update "${field.name}" (${field.id}) as a formula field because its type is "${field.type}".`
            );
        }

        return this.request(
            [
                "meta",
                "bases",
                baseId,
                "tables",
                table.id,
                "fields",
                field.id,
            ],
            {
                method: "PATCH",
                body: {
                    options: {
                        formula: formulaCode,
                    },
                },
            }
        );
    }

    async getBaseSchema(baseId) {
        assertNonEmptyString(baseId, "baseId");

        return this.request(["meta", "bases", baseId, "tables"], {
            method: "GET",
        });
    }

    async request(pathParts, init = {}) {
        const url = makeUrl(this.endpoint, pathParts);

        const fetchInit = {
            method: init.method ?? "GET",
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
                ...(init.headers ?? {}),
            },
        };

        if (init.body !== undefined) {
            fetchInit.body =
                typeof init.body === "string" ? init.body : JSON.stringify(init.body);
        }

        const response = await this.fetch(url, fetchInit);
        const data = await readJsonResponse(response);

        if (!response.ok) {
            const message =
                data?.error?.message ||
                data?.message ||
                `${response.status} ${response.statusText}`;

            const error = new Error(
                `Airtable request failed: ${message}\n${JSON.stringify(data, null, 2)}`
            );

            error.status = response.status;
            error.statusText = response.statusText;
            error.data = data;
            error.url = url;

            throw error;
        }

        return data;
    }
}


function parseFormulaPath(path) {
    assertNonEmptyString(path, "path");

    const parts = path
        .split("/")
        .map((part) => decodeURIComponent(part.trim()))
        .filter(Boolean);

    if (parts.length !== 3) {
        throw new Error(
            `Expected path format "baseId/tableNameOrId/fieldNameOrId", got: ${path}`
        );
    }

    const [baseId, tableRef, fieldRef] = parts;

    assertNonEmptyString(baseId, "baseId");
    assertNonEmptyString(tableRef, "tableNameOrId");
    assertNonEmptyString(fieldRef, "fieldNameOrId");

    return { baseId, tableRef, fieldRef };
}

function resolveTable(schema, tableRef) {
    const tables = schema?.tables;

    if (!Array.isArray(tables)) {
        throw new Error("Airtable base schema response did not include tables[].");
    }

    const table = tables.find(
        (candidate) => candidate.id === tableRef || candidate.name === tableRef
    );

    if (!table) {
        throw new Error(`Table not found: ${tableRef}`);
    }

    return table;
}

function resolveField(table, fieldRef) {
    const fields = table?.fields;

    if (!Array.isArray(fields)) {
        throw new Error(`Table "${table?.name ?? table?.id}" has no fields[].`);
    }

    const field = fields.find(
        (candidate) => candidate.id === fieldRef || candidate.name === fieldRef
    );

    if (!field) {
        throw new Error(
            `Field not found in table "${table.name}" (${table.id}): ${fieldRef}`
        );
    }

    return field;
}

function makeUrl(endpoint, pathParts) {
    const cleanEndpoint = endpoint.replace(/\/+$/, "");

    return [
        cleanEndpoint,
        ...pathParts.map((part) => encodeURIComponent(part)),
    ].join("/");
}

function isAirtableId(value, prefix) {
    return new RegExp(`^${prefix}[A-Za-z0-9]{14,}$`).test(value);
}

function assertNonEmptyString(value, name) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`${name} must be a non-empty string.`);
    }
}

async function readJsonResponse(response) {
    const text = await response.text();

    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return {
            error: {
                type: "INVALID_JSON_RESPONSE",
                message: "Response body was not valid JSON.",
            },
            body: text,
        };
    }
};