import {
    createReferenceIndex,
    resolveReference,
} from "../core/reference.ts";

export type SelectFullRecordsParams = {
    table: Table;
    view?: View["id"] | View["name"];
    recordIds?: AirtableRecord["id"][];
};

export type FullRecordFieldData = {
    cellValue: ReturnType<AirtableRecord["getCellValue"]>;
    cellString: string;
    readonly cellField: Field;
};

export type FullRecordData = Record<string, FullRecordFieldData>;

export type FullRecord = AirtableRecord & {
    data: FullRecordData;
    readonly recordTable: Table;
    Field: (
        ref: string,
        format?: "value" | "string" | "full"
    ) => ReturnType<AirtableRecord["getCellValue"]> | string | FullRecordFieldData | undefined;
};

export async function selectFullRecordsAsync({
    table,
    view,
    recordIds,
}: SelectFullRecordsParams): Promise<FullRecord[]> {
    const root = typeof view === "string" ? table.getView(view) : table;
    const qResult = await root.selectRecordsAsync({ fields: table.fields });

    const fieldMap = createReferenceIndex(table.fields);

    const wantedIds = Array.isArray(recordIds) && recordIds.length
        ? new Set(recordIds)
        : null;

    return qResult.records
        .filter((r) => !wantedIds || wantedIds.has(r.id))
        .map((r) => {
            const data: FullRecordData = {};

            for (const field of table.fields) {
                data[field.name] = {
                    cellValue: r.getCellValue(field.id),
                    cellString: r.getCellValueAsString(field.id),
                    get cellField() {
                        return field;
                    },
                };
            }

            const fullRecord = Object.assign(r, {
                data,
                get recordTable() {
                    return table;
                },
                Field(
                    ref: string,
                    format?: "value" | "string" | "full"
                ) {
                    const field = resolveReference(fieldMap, ref);
                    if (!field) return undefined;

                    const entry = data[field.name];
                    if (!entry) return undefined;

                    switch (format) {
                        case "value":
                            return entry.cellValue;
                        case "string":
                            return entry.cellString;
                        case "full":
                        case undefined:
                        default:
                            return entry;
                    }
                },
            });

            return fullRecord as FullRecord;
        });
}
