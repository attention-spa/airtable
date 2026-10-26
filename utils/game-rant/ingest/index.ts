import {
  type AirtableBaseLike,
  type AirtableFieldLike,
  type AttachmentValue,
  type FetchLike,
  chunk,
  decodeHtmlEntities,
  parseHtmlAttributes,
  resolveField,
  resolveTable,
  resolveView,
  stripHtmlTags,
  toAttachmentWriteValue,
  updateRecordsInBatches,
} from "../shared.ts";

export type IngestGameRantHtmlConfig = {
  base: AirtableBaseLike;
  table: string;
  view?: string;
  fields: {
    attachments: string;
    html: string;
    md: string;
    metadata?: string;
  };
  fetch?: FetchLike;
  deleteAttachmentsAfterParsing?: boolean;
};

export type IngestGameRantHtmlResult = {
  selected: number;
  eligible: number;
  fetched: number;
  updated: number;
  skipped: { id: string; name: string; reason: string }[];
  failed: { id: string; name: string; error: string }[];
};

type FetchTask = {
  record: import("../shared.ts").AirtableRecordLike;
  attachments: AttachmentValue[];
  attachment: AttachmentValue;
};

type FetchedTask = FetchTask & {
  pageHtml: string;
};

export async function ingestGameRantHtmlAttachments(
  config: IngestGameRantHtmlConfig,
): Promise<IngestGameRantHtmlResult> {
  const table = resolveTable(config.base, config.table);
  const view = resolveView(table, config.view);
  const attachmentField = resolveField(table, config.fields.attachments);
  const htmlField = resolveField(table, config.fields.html);
  const markdownField = resolveField(table, config.fields.md);
  const metadataField = config.fields.metadata
    ? resolveField(table, config.fields.metadata)
    : undefined;

  assertFieldType(attachmentField, ["multipleAttachments"], "attachments");
  assertFieldType(htmlField, ["multilineText", "richText"], "HTML");
  assertFieldType(markdownField, ["richText", "multilineText"], "Markdown");
  if (metadataField) {
    assertFieldType(metadataField, ["multilineText", "richText"], "metadata");
  }

  const fetchMethod =
    config.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
  if (typeof fetchMethod !== "function") {
    throw new TypeError("A fetch function is required in this runtime.");
  }

  const source = view ?? table;
  const query = await source.selectRecordsAsync({
    fields: [
      attachmentField.id,
      htmlField.id,
      markdownField.id,
      ...(metadataField ? [metadataField.id] : []),
    ],
  });

  const skipped: IngestGameRantHtmlResult["skipped"] = [];
  const failed: IngestGameRantHtmlResult["failed"] = [];
  const tasks: FetchTask[] = [];

  for (const record of query.records) {
    const attachments = normalizeAttachments(
      record.getCellValue(attachmentField.id),
    );
    const attachment = findGameRantHtmlAttachment(attachments);
    if (!attachment) {
      skipped.push({
        id: record.id,
        name: record.name,
        reason: "No GameRant HTML attachment found.",
      });
      continue;
    }
    tasks.push({ record, attachments, attachment });
  }

  const batchPromises = chunk(tasks, 50).map((batch) =>
    Promise.all(
      batch.map(async (task): Promise<FetchedTask | null> => {
        try {
          const response = await fetchMethod(task.attachment.url);
          if (response?.ok === false) {
            throw new Error(
              `Attachment fetch returned HTTP ${response.status ?? "error"}.`,
            );
          }
          return { ...task, pageHtml: await response.text() };
        } catch (error) {
          failed.push({
            id: task.record.id,
            name: task.record.name,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }),
    ),
  );

  // All Promise.all batches are created before the first await, so every
  // matching attachment fetch starts before parsing begins.
  const fetched = (await Promise.all(batchPromises))
    .flat()
    .filter((value): value is FetchedTask => Boolean(value));

  const updates: { id: string; fields: Record<string, unknown> }[] = [];
  const deleteAttachments = config.deleteAttachmentsAfterParsing ?? true;

  for (const task of fetched) {
    try {
      const articleBody = extractArticleBodyHtml(task.pageHtml);
      if (!articleBody) {
        throw new Error("Could not locate an articleBody container.");
      }

      const markdown = htmlToMarkdown(articleBody);
      const fields: Record<string, unknown> = {
        [htmlField.id]: articleBody,
        [markdownField.id]: markdown,
      };

      if (metadataField) {
        fields[metadataField.id] = serializeMetadataForField(
          extractGameRantMetadata(task.pageHtml),
          metadataField,
        );
      }

      if (deleteAttachments) {
        const remaining = task.attachments.filter(
          (attachment) =>
            attachment !== task.attachment &&
            attachment.id !== task.attachment.id,
        );
        fields[attachmentField.id] = toAttachmentWriteValue(remaining);
      }

      updates.push({ id: task.record.id, fields });
    } catch (error) {
      failed.push({
        id: task.record.id,
        name: task.record.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (updates.length) {
    await updateRecordsInBatches(table, updates, 50);
  }

  return {
    selected: query.records.length,
    eligible: tasks.length,
    fetched: fetched.length,
    updated: updates.length,
    skipped,
    failed,
  };
}

export function findGameRantHtmlAttachment(
  attachments: readonly AttachmentValue[],
): AttachmentValue | undefined {
  const htmlAttachments = attachments.filter((attachment) =>
    /\.html?$/i.test(attachment.filename ?? ""),
  );

  return (
    htmlAttachments.find((attachment) =>
      /(?:^|\s|[-_.])gamerant\.com(?:\s|[-_.]|$)/i.test(
        attachment.filename ?? "",
      ),
    ) ?? htmlAttachments[0]
  );
}

export function extractArticleBodyHtml(html: string): string | null {
  const source = String(html);
  const openingPattern = /<([a-z][\w:-]*)\b([^>]*)>/gi;

  for (const match of source.matchAll(openingPattern)) {
    const tagName = match[1].toLowerCase();
    const attrs = parseHtmlAttributes(match[2] ?? "");
    const classes = (attrs.class ?? "").split(/\s+/).filter(Boolean);
    const isArticleBody =
      classes.some((value) => value.toLowerCase() === "article-body") ||
      (attrs.id ?? "").toLowerCase() === "article-body" ||
      (attrs.itemprop ?? "").toLowerCase() === "articlebody";

    if (!isArticleBody || match.index == null) continue;

    const openEnd = match.index + match[0].length;
    const closingStart = findMatchingClosingTag(source, tagName, openEnd);
    if (closingStart >= 0) {
      return source.slice(openEnd, closingStart).trim();
    }
  }

  return null;
}

function findMatchingClosingTag(
  source: string,
  tagName: string,
  fromIndex: number,
): number {
  const tokenPattern = new RegExp(
    `<\\/?${escapeRegex(tagName)}\\b[^>]*>`,
    "gi",
  );
  tokenPattern.lastIndex = fromIndex;
  let depth = 1;

  while (true) {
    const match = tokenPattern.exec(source);
    if (!match || match.index == null) return -1;
    const token = match[0];
    if (/^<\//.test(token)) {
      depth -= 1;
      if (depth === 0) return match.index;
    } else if (!/\/>$/.test(token)) {
      depth += 1;
    }
  }
}

export function extractGameRantMetadata(
  html: string,
): Record<string, unknown> {
  const metadata = extractMetaTags(html);
  const vars = extractValnetGlobalVars(html);
  if (Object.keys(vars).length) metadata.VALNET_GLOBAL_VARS = vars;
  return metadata;
}

export function extractMetaTags(html: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const metaPattern = /<meta\b([^>]*)>/gi;

  for (const match of String(html).matchAll(metaPattern)) {
    const attrs = parseHtmlAttributes(match[1] ?? "");
    const rawName = (attrs.property || attrs.name || "").trim();
    const content = attrs.content;
    if (!rawName || content == null) continue;

    const path = normalizeMetaPath(rawName);
    if (!path.length) continue;
    setMetadataPath(result, path, content);
  }

  return result;
}

function normalizeMetaPath(rawName: string): string[] {
  const parts = rawName
    .trim()
    .toLowerCase()
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts[0] === "og") parts.shift();
  return parts;
}

function setMetadataPath(
  target: Record<string, unknown>,
  path: string[],
  value: string,
): void {
  let cursor: Record<string, unknown> = target;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const current = cursor[key];

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      cursor[key] = current == null ? {} : { value: current };
    }

    cursor = cursor[key] as Record<string, unknown>;
  }

  const leaf = path[path.length - 1];
  const current = cursor[leaf];
  if (current && typeof current === "object" && !Array.isArray(current)) {
    (current as Record<string, unknown>).value = value;
  } else {
    cursor[leaf] = value;
  }
}

export function extractValnetGlobalVars(
  html: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;

  for (const scriptMatch of String(html).matchAll(scriptPattern)) {
    const script = scriptMatch[1] ?? "";
    const declarationPattern = /\bvar\s+VALNET_GLOBAL_([A-Z0-9_]+)\s*=\s*/g;

    while (true) {
      const match = declarationPattern.exec(script);
      if (!match || match.index == null) break;
      const scanned = scanJavascriptAssignmentValue(
        script,
        declarationPattern.lastIndex,
      );
      if (!scanned) continue;
      result[match[1].toLowerCase()] = parseJavascriptLiteral(scanned.value);
      declarationPattern.lastIndex = scanned.endIndex;
    }
  }

  return result;
}

function scanJavascriptAssignmentValue(
  source: string,
  startIndex: number,
): { value: string; endIndex: number } | null {
  let quote = "";
  let escaped = false;
  let squareDepth = 0;
  let curlyDepth = 0;
  let parenDepth = 0;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "[") squareDepth += 1;
    else if (char === "]") squareDepth = Math.max(0, squareDepth - 1);
    else if (char === "{") curlyDepth += 1;
    else if (char === "}") curlyDepth = Math.max(0, curlyDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (
      char === ";" &&
      squareDepth === 0 &&
      curlyDepth === 0 &&
      parenDepth === 0
    ) {
      return {
        value: source.slice(startIndex, index).trim(),
        endIndex: index + 1,
      };
    }
  }

  return null;
}

function parseJavascriptLiteral(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    return Number(trimmed);
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return decodeJavascriptString(trimmed.slice(1, -1));
  }

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function decodeJavascriptString(value: string): string {
  return value.replace(
    /\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|.|$)/gi,
    (_match, escape: string) => {
      if (escape.startsWith("u{")) {
        return String.fromCodePoint(Number.parseInt(escape.slice(2, -1), 16));
      }
      if (escape.startsWith("u")) {
        return String.fromCodePoint(Number.parseInt(escape.slice(1), 16));
      }
      if (escape.startsWith("x")) {
        return String.fromCodePoint(Number.parseInt(escape.slice(1), 16));
      }
      const mapped: Record<string, string> = {
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
        "0": "\0",
        "\\": "\\",
        '"': '"',
        "'": "'",
        "/": "/",
      };
      return mapped[escape] ?? escape;
    },
  );
}

export function serializeMetadataForField(
  metadata: Record<string, unknown>,
  field: Pick<AirtableFieldLike, "type">,
): string {
  const json = JSON.stringify(metadata, null, 2);
  return field.type === "richText" ? `\`\`\`\n${json}\n\`\`\`` : json;
}

export function htmlToMarkdown(html: string): string {
  let value = String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|noscript|svg|iframe|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      "",
    )
    .replace(/<hr\b[^>]*\/?>/gi, "\n\n---\n\n")
    .replace(/<br\b[^>]*\/?>/gi, "\n")
    .replace(/<img\b([^>]*)>/gi, (_match, attrsSource: string) => {
      const attrs = parseHtmlAttributes(attrsSource);
      const src = attrs.src || attrs["data-src"] || "";
      if (!src) return "";
      const alt = (attrs.alt || "").replace(/\]/g, "\\]");
      return `![${alt}](${src})`;
    });

  value = replacePairedTag(value, "a", (inner, attrsSource) => {
    const attrs = parseHtmlAttributes(attrsSource);
    const href = attrs.href || "";
    const text = stripHtmlTags(inner).trim();
    return href && text ? `[${text}](${href})` : text;
  });

  for (const [tag, marker] of [
    ["strong", "**"],
    ["b", "**"],
    ["em", "*"],
    ["i", "*"],
    ["del", "~~"],
    ["s", "~~"],
  ] as const) {
    value = replacePairedTag(
      value,
      tag,
      (inner) => `${marker}${stripHtmlTags(inner).trim()}${marker}`,
    );
  }

  value = replacePairedTag(
    value,
    "code",
    (inner) => `\`${decodeHtmlEntities(stripHtmlTags(inner))}\``,
  );
  value = replacePairedTag(
    value,
    "pre",
    (inner) =>
      `\n\n\`\`\`\n${decodeHtmlEntities(stripHtmlTags(inner)).trim()}\n\`\`\`\n\n`,
  );

  for (let level = 6; level >= 1; level -= 1) {
    value = replacePairedTag(
      value,
      `h${level}`,
      (inner) =>
        `\n\n${"#".repeat(level)} ${stripHtmlTags(inner).trim()}\n\n`,
    );
  }

  value = replacePairedTag(value, "blockquote", (inner) => {
    const text = htmlToMarkdown(inner).trim();
    return `\n\n${text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")}\n\n`;
  });

  value = value.replace(
    /<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi,
    (_match, inner: string) => `\n- ${htmlToMarkdown(inner).trim()}`,
  );
  value = value.replace(/<\/?(?:ul|ol)\b[^>]*>/gi, "\n");
  value = value.replace(
    /<\/?(?:p|div|section|article|figure|figcaption|header|footer|main|aside)\b[^>]*>/gi,
    "\n\n",
  );
  value = decodeHtmlEntities(value.replace(/<[^>]+>/g, ""));

  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function replacePairedTag(
  source: string,
  tagName: string,
  replacer: (inner: string, attrsSource: string) => string,
): string {
  const pattern = new RegExp(
    `<${escapeRegex(tagName)}\\b([^>]*)>([\\s\\S]*?)<\\/${escapeRegex(
      tagName,
    )}\\s*>`,
    "gi",
  );
  let previous = "";
  let current = source;
  while (current !== previous) {
    previous = current;
    current = current.replace(
      pattern,
      (_match, attrs: string, inner: string) => replacer(inner, attrs),
    );
  }
  return current;
}

function normalizeAttachments(value: unknown): AttachmentValue[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is AttachmentValue =>
          Boolean(
            entry &&
              typeof entry === "object" &&
              typeof (entry as AttachmentValue).url === "string",
          ),
      )
    : [];
}

function assertFieldType(
  field: AirtableFieldLike,
  allowed: readonly string[],
  label: string,
): void {
  if (!allowed.includes(field.type)) {
    throw new TypeError(
      `${label} field ${field.name} has unsupported type ${field.type}.`,
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
