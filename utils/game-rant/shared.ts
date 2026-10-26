import {
  chunk,
  createReferenceIndex,
  resolveReference,
  runInBatches,
} from "../core/index.ts";

export { chunk };

export type FetchResponseLike = {
  ok?: boolean;
  status?: number;
  text(): Promise<string>;
};

export type FetchLike = (
  input: string,
  init?: Record<string, unknown>,
) => Promise<FetchResponseLike>;

export type AttachmentValue = {
  id?: string;
  url: string;
  filename?: string;
  [key: string]: unknown;
};

export type AirtableRecordLike = {
  id: string;
  name: string;
  getCellValue(fieldOrIdOrName: unknown): unknown;
  getCellValueAsString(fieldOrIdOrName: unknown): string;
};

export type AirtableFieldLike = {
  id: string;
  name: string;
  type: string;
};

export type RecordQueryResultLike = {
  records: readonly AirtableRecordLike[];
};

export type AirtableRecordSourceLike = {
  selectRecordsAsync(options?: {
    fields?: readonly unknown[];
  }): Promise<RecordQueryResultLike>;
};

export type AirtableViewLike = AirtableRecordSourceLike & {
  id: string;
  name: string;
};

export type AirtableTableLike = AirtableRecordSourceLike & {
  id: string;
  name: string;
  fields: readonly AirtableFieldLike[];
  views?: readonly AirtableViewLike[];
  getView?(ref: string): AirtableViewLike;
  updateRecordsAsync(
    records: readonly { id: string; fields: Record<string, unknown> }[],
  ): Promise<unknown>;
};

export type AirtableBaseLike = {
  tables: readonly AirtableTableLike[];
  getTable?(ref: string): AirtableTableLike;
};

export function normalizeReference(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveByIdOrName<T extends { id: string; name: string }>(
  values: readonly T[],
  reference: string,
  label: string,
): T {
  const result = resolveReference(createReferenceIndex(values), reference);

  if (!result) {
    throw new Error(`Unknown ${label}: ${reference}`);
  }

  return result;
}

export function resolveTable(
  base: AirtableBaseLike,
  reference: string,
): AirtableTableLike {
  return resolveByIdOrName(base.tables, reference, "table");
}

export function resolveField(
  table: AirtableTableLike,
  reference: string,
): AirtableFieldLike {
  return resolveByIdOrName(table.fields, reference, `field in ${table.name}`);
}

export function resolveView(
  table: AirtableTableLike,
  reference?: string,
): AirtableViewLike | undefined {
  if (!reference) return undefined;
  return resolveByIdOrName(
    table.views ?? [],
    reference,
    `view in ${table.name}`,
  );
}

export async function updateRecordsInBatches(
  table: AirtableTableLike,
  updates: readonly { id: string; fields: Record<string, unknown> }[],
  size = 50,
): Promise<void> {
  await runInBatches(updates, size, async (batch) => {
    await table.updateRecordsAsync(batch);
  });
}

export function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
  };

  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/&#(\d+);/g, (match, decimal: string) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(
      /&([a-z][a-z0-9]+);/gi,
      (match, entity: string) => named[entity.toLowerCase()] ?? match,
    );
}

export function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHtmlAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\s"'=<>`]+)))?/g;

  for (const match of source.matchAll(attrPattern)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[name] = decodeHtmlEntities(rawValue);
  }

  return attrs;
}

export function toAttachmentWriteValue(
  attachments: readonly AttachmentValue[],
): { url: string; filename?: string }[] {
  return attachments
    .filter(
      (attachment) =>
        typeof attachment?.url === "string" && attachment.url.length > 0,
    )
    .map((attachment) => ({
      url: attachment.url,
      ...(attachment.filename ? { filename: attachment.filename } : {}),
    }));
}
