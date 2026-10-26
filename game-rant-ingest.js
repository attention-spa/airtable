"use strict";
var gameRantIngestModule = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // utils/game-rant/ingest/index.ts
  var index_exports = {};
  __export(index_exports, {
    extractArticleBodyHtml: () => extractArticleBodyHtml,
    extractGameRantMetadata: () => extractGameRantMetadata,
    extractMetaTags: () => extractMetaTags,
    extractValnetGlobalVars: () => extractValnetGlobalVars,
    findGameRantHtmlAttachment: () => findGameRantHtmlAttachment,
    htmlToMarkdown: () => htmlToMarkdown,
    ingestGameRantHtmlAttachments: () => ingestGameRantHtmlAttachments,
    serializeMetadataForField: () => serializeMetadataForField
  });

  // utils/core/batching.ts
  function chunk(values, size) {
    if (!Number.isInteger(size) || size < 1) {
      throw new RangeError("Batch size must be a positive integer.");
    }
    const result = [];
    for (let index = 0; index < values.length; index += size) {
      result.push(values.slice(index, index + size));
    }
    return result;
  }
  async function runInBatches(values, size, run) {
    const batches = chunk(values, size);
    for (const batch of batches) {
      await run(batch);
    }
    return batches.length;
  }

  // utils/core/reference.ts
  function normalizeRef(value) {
    return String(value).trim().toLowerCase();
  }
  function createReferenceIndex(values) {
    const index = /* @__PURE__ */ new Map();
    for (const value of values) {
      index.set(normalizeRef(value.id), value);
      index.set(normalizeRef(value.name), value);
    }
    return index;
  }
  function resolveReference(index, reference) {
    return index.get(normalizeRef(reference));
  }

  // utils/game-rant/shared.ts
  function resolveByIdOrName(values, reference, label) {
    const result = resolveReference(createReferenceIndex(values), reference);
    if (!result) {
      throw new Error(`Unknown ${label}: ${reference}`);
    }
    return result;
  }
  function resolveTable(base, reference) {
    return resolveByIdOrName(base.tables, reference, "table");
  }
  function resolveField(table, reference) {
    return resolveByIdOrName(table.fields, reference, `field in ${table.name}`);
  }
  function resolveView(table, reference) {
    if (!reference) return void 0;
    return resolveByIdOrName(
      table.views ?? [],
      reference,
      `view in ${table.name}`
    );
  }
  async function updateRecordsInBatches(table, updates, size = 50) {
    await runInBatches(updates, size, async (batch) => {
      await table.updateRecordsAsync(batch);
    });
  }
  function decodeHtmlEntities(value) {
    const named = {
      amp: "&",
      apos: "'",
      gt: ">",
      hellip: "\u2026",
      ldquo: "\u201C",
      lsquo: "\u2018",
      lt: "<",
      mdash: "\u2014",
      nbsp: " ",
      ndash: "\u2013",
      quot: '"',
      rdquo: "\u201D",
      rsquo: "\u2019"
    };
    return String(value).replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }).replace(/&#(\d+);/g, (match, decimal) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }).replace(
      /&([a-z][a-z0-9]+);/gi,
      (match, entity) => named[entity.toLowerCase()] ?? match
    );
  }
  function stripHtmlTags(value) {
    return decodeHtmlEntities(
      String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ").replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ").trim();
  }
  function parseHtmlAttributes(source) {
    const attrs = {};
    const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([^\s"'=<>`]+)))?/g;
    for (const match of source.matchAll(attrPattern)) {
      const name = match[1]?.toLowerCase();
      if (!name) continue;
      const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
      attrs[name] = decodeHtmlEntities(rawValue);
    }
    return attrs;
  }
  function toAttachmentWriteValue(attachments) {
    return attachments.filter(
      (attachment) => typeof attachment?.url === "string" && attachment.url.length > 0
    ).map((attachment) => ({
      url: attachment.url,
      ...attachment.filename ? { filename: attachment.filename } : {}
    }));
  }

  // utils/game-rant/ingest/index.ts
  async function ingestGameRantHtmlAttachments(config) {
    const table = resolveTable(config.base, config.table);
    const view = resolveView(table, config.view);
    const attachmentField = resolveField(table, config.fields.attachments);
    const htmlField = resolveField(table, config.fields.html);
    const markdownField = resolveField(table, config.fields.md);
    const metadataField = config.fields.metadata ? resolveField(table, config.fields.metadata) : void 0;
    assertFieldType(attachmentField, ["multipleAttachments"], "attachments");
    assertFieldType(htmlField, ["multilineText", "richText"], "HTML");
    assertFieldType(markdownField, ["richText", "multilineText"], "Markdown");
    if (metadataField) {
      assertFieldType(metadataField, ["multilineText", "richText"], "metadata");
    }
    const fetchMethod = config.fetch ?? globalThis.fetch;
    if (typeof fetchMethod !== "function") {
      throw new TypeError("A fetch function is required in this runtime.");
    }
    const source = view ?? table;
    const query = await source.selectRecordsAsync({
      fields: [
        attachmentField.id,
        htmlField.id,
        markdownField.id,
        ...metadataField ? [metadataField.id] : []
      ]
    });
    const skipped = [];
    const failed = [];
    const tasks = [];
    for (const record of query.records) {
      const attachments = normalizeAttachments(
        record.getCellValue(attachmentField.id)
      );
      const attachment = findGameRantHtmlAttachment(attachments);
      if (!attachment) {
        skipped.push({
          id: record.id,
          name: record.name,
          reason: "No GameRant HTML attachment found."
        });
        continue;
      }
      tasks.push({ record, attachments, attachment });
    }
    const batchPromises = chunk(tasks, 50).map(
      (batch) => Promise.all(
        batch.map(async (task) => {
          try {
            const response = await fetchMethod(task.attachment.url);
            if (response?.ok === false) {
              throw new Error(
                `Attachment fetch returned HTTP ${response.status ?? "error"}.`
              );
            }
            return { ...task, pageHtml: await response.text() };
          } catch (error) {
            failed.push({
              id: task.record.id,
              name: task.record.name,
              error: error instanceof Error ? error.message : String(error)
            });
            return null;
          }
        })
      )
    );
    const fetched = (await Promise.all(batchPromises)).flat().filter((value) => Boolean(value));
    const updates = [];
    const deleteAttachments = config.deleteAttachmentsAfterParsing ?? true;
    for (const task of fetched) {
      try {
        const articleBody = extractArticleBodyHtml(task.pageHtml);
        if (!articleBody) {
          throw new Error("Could not locate an articleBody container.");
        }
        const markdown = htmlToMarkdown(articleBody);
        const fields = {
          [htmlField.id]: articleBody,
          [markdownField.id]: markdown
        };
        if (metadataField) {
          fields[metadataField.id] = serializeMetadataForField(
            extractGameRantMetadata(task.pageHtml),
            metadataField
          );
        }
        if (deleteAttachments) {
          const remaining = task.attachments.filter(
            (attachment) => attachment !== task.attachment && attachment.id !== task.attachment.id
          );
          fields[attachmentField.id] = toAttachmentWriteValue(remaining);
        }
        updates.push({ id: task.record.id, fields });
      } catch (error) {
        failed.push({
          id: task.record.id,
          name: task.record.name,
          error: error instanceof Error ? error.message : String(error)
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
      failed
    };
  }
  function findGameRantHtmlAttachment(attachments) {
    const htmlAttachments = attachments.filter(
      (attachment) => /\.html?$/i.test(attachment.filename ?? "")
    );
    return htmlAttachments.find(
      (attachment) => /(?:^|\s|[-_.])gamerant\.com(?:\s|[-_.]|$)/i.test(
        attachment.filename ?? ""
      )
    ) ?? htmlAttachments[0];
  }
  function extractArticleBodyHtml(html) {
    const source = String(html);
    const openingPattern = /<([a-z][\w:-]*)\b([^>]*)>/gi;
    for (const match of source.matchAll(openingPattern)) {
      const tagName = match[1].toLowerCase();
      const attrs = parseHtmlAttributes(match[2] ?? "");
      const classes = (attrs.class ?? "").split(/\s+/).filter(Boolean);
      const isArticleBody = classes.some((value) => value.toLowerCase() === "article-body") || (attrs.id ?? "").toLowerCase() === "article-body" || (attrs.itemprop ?? "").toLowerCase() === "articlebody";
      if (!isArticleBody || match.index == null) continue;
      const openEnd = match.index + match[0].length;
      const closingStart = findMatchingClosingTag(source, tagName, openEnd);
      if (closingStart >= 0) {
        return source.slice(openEnd, closingStart).trim();
      }
    }
    return null;
  }
  function findMatchingClosingTag(source, tagName, fromIndex) {
    const tokenPattern = new RegExp(
      `<\\/?${escapeRegex(tagName)}\\b[^>]*>`,
      "gi"
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
  function extractGameRantMetadata(html) {
    const metadata = extractMetaTags(html);
    const vars = extractValnetGlobalVars(html);
    if (Object.keys(vars).length) metadata.VALNET_GLOBAL_VARS = vars;
    return metadata;
  }
  function extractMetaTags(html) {
    const result = {};
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
  function normalizeMetaPath(rawName) {
    const parts = rawName.trim().toLowerCase().split(":").map((part) => part.trim()).filter(Boolean);
    if (parts[0] === "og") parts.shift();
    return parts;
  }
  function setMetadataPath(target, path, value) {
    let cursor = target;
    for (let index = 0; index < path.length - 1; index += 1) {
      const key = path[index];
      const current2 = cursor[key];
      if (!current2 || typeof current2 !== "object" || Array.isArray(current2)) {
        cursor[key] = current2 == null ? {} : { value: current2 };
      }
      cursor = cursor[key];
    }
    const leaf = path[path.length - 1];
    const current = cursor[leaf];
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current.value = value;
    } else {
      cursor[leaf] = value;
    }
  }
  function extractValnetGlobalVars(html) {
    const result = {};
    const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
    for (const scriptMatch of String(html).matchAll(scriptPattern)) {
      const script = scriptMatch[1] ?? "";
      const declarationPattern = /\bvar\s+VALNET_GLOBAL_([A-Z0-9_]+)\s*=\s*/g;
      while (true) {
        const match = declarationPattern.exec(script);
        if (!match || match.index == null) break;
        const scanned = scanJavascriptAssignmentValue(
          script,
          declarationPattern.lastIndex
        );
        if (!scanned) continue;
        result[match[1].toLowerCase()] = parseJavascriptLiteral(scanned.value);
        declarationPattern.lastIndex = scanned.endIndex;
      }
    }
    return result;
  }
  function scanJavascriptAssignmentValue(source, startIndex) {
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
      else if (char === ";" && squareDepth === 0 && curlyDepth === 0 && parenDepth === 0) {
        return {
          value: source.slice(startIndex, index).trim(),
          endIndex: index + 1
        };
      }
    }
    return null;
  }
  function parseJavascriptLiteral(value) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
      return Number(trimmed);
    }
    if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return decodeJavascriptString(trimmed.slice(1, -1));
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]") || trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  function decodeJavascriptString(value) {
    return value.replace(
      /\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|.|$)/gi,
      (_match, escape) => {
        if (escape.startsWith("u{")) {
          return String.fromCodePoint(Number.parseInt(escape.slice(2, -1), 16));
        }
        if (escape.startsWith("u")) {
          return String.fromCodePoint(Number.parseInt(escape.slice(1), 16));
        }
        if (escape.startsWith("x")) {
          return String.fromCodePoint(Number.parseInt(escape.slice(1), 16));
        }
        const mapped = {
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "	",
          v: "\v",
          "0": "\0",
          "\\": "\\",
          '"': '"',
          "'": "'",
          "/": "/"
        };
        return mapped[escape] ?? escape;
      }
    );
  }
  function serializeMetadataForField(metadata, field) {
    const json = JSON.stringify(metadata, null, 2);
    return field.type === "richText" ? `\`\`\`
${json}
\`\`\`` : json;
  }
  function htmlToMarkdown(html) {
    let value = String(html).replace(/<!--[\s\S]*?-->/g, "").replace(
      /<(script|style|noscript|svg|iframe|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ""
    ).replace(/<hr\b[^>]*\/?>/gi, "\n\n---\n\n").replace(/<br\b[^>]*\/?>/gi, "\n").replace(/<img\b([^>]*)>/gi, (_match, attrsSource) => {
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
      ["s", "~~"]
    ]) {
      value = replacePairedTag(
        value,
        tag,
        (inner) => `${marker}${stripHtmlTags(inner).trim()}${marker}`
      );
    }
    value = replacePairedTag(
      value,
      "code",
      (inner) => `\`${decodeHtmlEntities(stripHtmlTags(inner))}\``
    );
    value = replacePairedTag(
      value,
      "pre",
      (inner) => `

\`\`\`
${decodeHtmlEntities(stripHtmlTags(inner)).trim()}
\`\`\`

`
    );
    for (let level = 6; level >= 1; level -= 1) {
      value = replacePairedTag(
        value,
        `h${level}`,
        (inner) => `

${"#".repeat(level)} ${stripHtmlTags(inner).trim()}

`
      );
    }
    value = replacePairedTag(value, "blockquote", (inner) => {
      const text = htmlToMarkdown(inner).trim();
      return `

${text.split("\n").map((line) => `> ${line}`).join("\n")}

`;
    });
    value = value.replace(
      /<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi,
      (_match, inner) => `
- ${htmlToMarkdown(inner).trim()}`
    );
    value = value.replace(/<\/?(?:ul|ol)\b[^>]*>/gi, "\n");
    value = value.replace(
      /<\/?(?:p|div|section|article|figure|figcaption|header|footer|main|aside)\b[^>]*>/gi,
      "\n\n"
    );
    value = decodeHtmlEntities(value.replace(/<[^>]+>/g, ""));
    return value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  }
  function replacePairedTag(source, tagName, replacer) {
    const pattern = new RegExp(
      `<${escapeRegex(tagName)}\\b([^>]*)>([\\s\\S]*?)<\\/${escapeRegex(
        tagName
      )}\\s*>`,
      "gi"
    );
    let previous = "";
    let current = source;
    while (current !== previous) {
      previous = current;
      current = current.replace(
        pattern,
        (_match, attrs, inner) => replacer(inner, attrs)
      );
    }
    return current;
  }
  function normalizeAttachments(value) {
    return Array.isArray(value) ? value.filter(
      (entry) => Boolean(
        entry && typeof entry === "object" && typeof entry.url === "string"
      )
    ) : [];
  }
  function assertFieldType(field, allowed, label) {
    if (!allowed.includes(field.type)) {
      throw new TypeError(
        `${label} field ${field.name} has unsupported type ${field.type}.`
      );
    }
  }
  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return __toCommonJS(index_exports);
})();
