"use strict";
var gameRantBackfillModule = (() => {
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

  // utils/game-rant/backfill/index.ts
  var index_exports = {};
  __export(index_exports, {
    backfillGameRantLinks: () => backfillGameRantLinks,
    canonicalGameRantUrl: () => canonicalGameRantUrl,
    extractArticleLinks: () => extractArticleLinks,
    gameRantHtmlFilename: () => gameRantHtmlFilename,
    normTitle: () => normTitle,
    titleSimilarity: () => titleSimilarity
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

  // utils/game-rant/backfill/index.ts
  async function backfillGameRantLinks(config) {
    const table = resolveTable(config.base, config.table);
    const view = resolveView(table, config.view);
    const urlField = resolveField(table, config.fields.url);
    const attachmentField = resolveField(table, config.fields.attachments);
    if (attachmentField.type !== "multipleAttachments") {
      throw new TypeError(
        `Attachment field ${attachmentField.name} must be multipleAttachments.`
      );
    }
    if (!["url", "singleLineText", "multilineText", "richText"].includes(
      urlField.type
    )) {
      throw new TypeError(
        `URL field ${urlField.name} must be a text-like or URL field.`
      );
    }
    const source = view ?? table;
    const selected = await source.selectRecordsAsync({
      fields: [urlField.id, attachmentField.id]
    });
    const missing = selected.records.filter(
      (record) => !record.getCellValueAsString(urlField.id).trim()
    );
    if (!missing.length) {
      return {
        missingAtStart: 0,
        candidatesFromAuthorPages: 0,
        updated: 0,
        exactMatches: 0,
        fuzzyMatches: 0,
        searchMatches: 0,
        unresolved: 0,
        unresolvedRecords: []
      };
    }
    const allRecords = await table.selectRecordsAsync({ fields: [urlField.id] });
    const existingPaths = /* @__PURE__ */ new Set();
    for (const record of allRecords.records) {
      const canonical = canonicalGameRantUrl(
        record.getCellValueAsString(urlField.id)
      );
      if (canonical) existingPaths.add(canonical);
    }
    const maxPagesToFetch = finiteInteger(config.maxPagesToFetch, 40, 1);
    const startingPageNumber = finiteInteger(config.startingPageNumber, 1, 1);
    const maxSearchFallbacks = finiteInteger(config.maxSearchFallbacks, 150, 0);
    const fetchConcurrency = finiteInteger(config.fetchConcurrency, 5, 1);
    const maxUpdatesPerRun = finiteInteger(config.maxUpdatesPerRun, 200, 1);
    const fuzzyThreshold = finiteNumber(config.fuzzyThreshold, 0.86);
    const fuzzyMargin = finiteNumber(config.fuzzyMargin, 0.04);
    const searchThreshold = finiteNumber(config.searchThreshold, 0.8);
    const authorSlug = (config.authorSlug || "dominik-bosnjak").trim().replace(/^\/+|\/+$/g, "");
    const updates = [];
    const matchedIds = /* @__PURE__ */ new Set();
    const stats = {
      exactMatches: 0,
      fuzzyMatches: 0,
      searchMatches: 0
    };
    const queueMatch = (record, article, type, score = 1) => {
      if (matchedIds.has(record.id) || updates.length >= maxUpdatesPerRun) {
        return false;
      }
      const canonical = canonicalGameRantUrl(article.path);
      if (!canonical || existingPaths.has(canonical)) return false;
      const currentAttachments = normalizeAttachments(
        record.getCellValue(attachmentField.id)
      );
      const filename = gameRantHtmlFilename(canonical);
      const hasAttachment = currentAttachments.some(
        (attachment) => attachment.filename?.toLowerCase() === filename.toLowerCase()
      );
      updates.push({
        id: record.id,
        fields: {
          [urlField.id]: canonical,
          [attachmentField.id]: hasAttachment ? toAttachmentWriteValue(currentAttachments) : [
            ...toAttachmentWriteValue(currentAttachments),
            { url: canonical, filename }
          ]
        }
      });
      matchedIds.add(record.id);
      existingPaths.add(canonical);
      stats[type] += 1;
      console.log({
        matchType: type,
        score: Number(score.toFixed(4)),
        airtableTitle: record.name,
        gameRantTitle: article.title,
        url: canonical,
        attachmentFilename: filename
      });
      return true;
    };
    const pageNumbers = Array.from(
      { length: maxPagesToFetch },
      (_, index) => startingPageNumber + index
    );
    const authorPageResults = await mapWithConcurrency(
      pageNumbers,
      fetchConcurrency,
      async (pageNumber) => {
        const url = pageNumber > 1 ? `https://gamerant.com/author/${authorSlug}/page/${pageNumber}/` : `https://gamerant.com/author/${authorSlug}/`;
        const html = await fetchText(config.fetch, url);
        return extractArticleLinks(html);
      }
    );
    const allPages = dedupeArticles(authorPageResults.flat());
    const recordsByTitle = /* @__PURE__ */ new Map();
    for (const record of missing) {
      const normalized = normTitle(record.name);
      if (!normalized) continue;
      const values = recordsByTitle.get(normalized) ?? [];
      values.push(record);
      recordsByTitle.set(normalized, values);
    }
    for (const article of allPages) {
      if (updates.length >= maxUpdatesPerRun) break;
      const candidates = recordsByTitle.get(normTitle(article.title));
      const record = candidates?.find(
        (candidate) => !matchedIds.has(candidate.id)
      );
      if (record) queueMatch(record, article, "exactMatches");
    }
    for (const record of missing.filter((value) => !matchedIds.has(value.id))) {
      if (updates.length >= maxUpdatesPerRun) break;
      const scored = allPages.filter((article) => !existingPaths.has(article.path)).map((article) => ({
        article,
        score: titleSimilarity(record.name, article.title)
      })).sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (!best) continue;
      const second = scored[1];
      const margin = second ? best.score - second.score : 1;
      if (best.score >= fuzzyThreshold && (best.score >= 0.94 || margin >= fuzzyMargin)) {
        queueMatch(record, best.article, "fuzzyMatches", best.score);
      }
    }
    const unresolvedForSearch = missing.filter((record) => !matchedIds.has(record.id)).slice(0, maxSearchFallbacks);
    const searchResults = await mapWithConcurrency(
      unresolvedForSearch,
      fetchConcurrency,
      async (record) => ({
        record,
        results: await gameRantSearch(record.name, config.fetch)
      })
    );
    for (const { record, results } of searchResults) {
      if (updates.length >= maxUpdatesPerRun) break;
      if (matchedIds.has(record.id)) continue;
      const scored = results.filter((article) => !existingPaths.has(article.path)).map((article) => ({
        article,
        score: titleSimilarity(record.name, article.title)
      })).sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (!best) continue;
      const second = scored[1];
      const margin = second ? best.score - second.score : 1;
      if (best.score >= searchThreshold && (best.score >= 0.93 || margin >= fuzzyMargin)) {
        queueMatch(record, best.article, "searchMatches", best.score);
      }
    }
    if (updates.length) {
      await updateRecordsInBatches(table, updates, 50);
    }
    const unresolvedRecords = missing.filter((record) => !matchedIds.has(record.id)).map((record) => ({ id: record.id, name: record.name }));
    return {
      missingAtStart: missing.length,
      candidatesFromAuthorPages: allPages.length,
      updated: updates.length,
      ...stats,
      unresolved: unresolvedRecords.length,
      unresolvedRecords
    };
  }
  function canonicalGameRantUrl(href) {
    if (!href) return null;
    let url;
    try {
      url = new URL(String(href), "https://gamerant.com");
    } catch {
      return null;
    }
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "gamerant.com") return null;
    const pathname = url.pathname.startsWith("/") ? url.pathname : `/${url.pathname}`;
    if (/^\/(?:db|author|tag|category|search|page)(?:\/|$)/i.test(pathname)) {
      return null;
    }
    if (/^\/(?:terms-of-use|privacy-policy|dmca-take-down-policy|press-kit|fact-checking-policy|corrections-policy|ethics-policy|ownership-funding-advertising-policy)(?:\/|$)/i.test(
      pathname
    )) {
      return null;
    }
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length !== 1 || !segments[0].includes("-")) return null;
    return `https://gamerant.com/${segments[0]}/`;
  }
  function gameRantHtmlFilename(urlValue) {
    const url = new URL(urlValue);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    const pathWithSpaces = path.replace(/\//g, " ");
    return `${hostname}${pathWithSpaces ? ` ${pathWithSpaces}` : ""}.html`;
  }
  function normTitle(value) {
    if (!value) return "";
    return decodeHtmlEntities(String(value)).replace(/(?:\s*\[[^\]]*\]\s*)+$/gi, "").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[’‘`´]/g, "'").replace(/[“”„]/g, '"').replace(/[–—−]/g, "-").replace(/&/g, " and ").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function titleSimilarity(a, b) {
    const A = normTitle(a);
    const B = normTitle(b);
    if (!A || !B) return 0;
    if (A === B) return 1;
    const maxLength = Math.max(A.length, B.length);
    const levenshteinScore = 1 - levenshteinDistance(A, B) / maxLength;
    const aTokens = new Set(A.split(" ").filter(Boolean));
    const bTokens = new Set(B.split(" ").filter(Boolean));
    let shared = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) shared += 1;
    }
    const tokenDice = aTokens.size + bTokens.size ? 2 * shared / (aTokens.size + bTokens.size) : 0;
    return levenshteinScore * 0.7 + tokenDice * 0.3;
  }
  function extractArticleLinks(html) {
    const found = /* @__PURE__ */ new Map();
    const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
    for (const match of String(html).matchAll(anchorPattern)) {
      const attrs = parseHtmlAttributes(match[1] ?? "");
      const href = attrs.href;
      const path = canonicalGameRantUrl(href);
      if (!path) continue;
      const title = cleanDisplayTitle(attrs.title) || cleanDisplayTitle(stripHtmlTags(match[2] ?? ""));
      if (!title) continue;
      const previous = found.get(path);
      if (!previous || normTitle(title).length > normTitle(previous.title).length) {
        found.set(path, { href, path, title });
      }
    }
    return [...found.values()];
  }
  async function gameRantSearch(query, fetchMethod) {
    const encoded = encodeURIComponent(String(query).trim()).replace(/%20/g, "+");
    const html = await fetchText(
      fetchMethod,
      `https://gamerant.com/search/?q=${encoded}`
    );
    return extractArticleLinks(html);
  }
  async function fetchText(fetchMethod, url) {
    try {
      const response = await fetchMethod(url);
      if (response?.ok === false) {
        console.warn({ url, status: response.status });
      }
      return await response.text();
    } catch (error) {
      console.error({
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return "";
    }
  }
  function cleanDisplayTitle(value) {
    return value ? decodeHtmlEntities(String(value)).replace(/\s+/g, " ").trim() : "";
  }
  function dedupeArticles(articles) {
    const byPath = /* @__PURE__ */ new Map();
    for (const article of articles) {
      if (!article?.path) continue;
      const previous = byPath.get(article.path);
      if (!previous || normTitle(article.title).length > normTitle(previous.title).length) {
        byPath.set(article.path, article);
      }
    }
    return [...byPath.values()];
  }
  async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
      while (true) {
        const index = nextIndex++;
        if (index >= items.length) return;
        results[index] = await mapper(items[index], index);
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(Math.max(1, limit), items.length) },
        () => worker()
      )
    );
    return results;
  }
  function normalizeAttachments(value) {
    return Array.isArray(value) ? value.filter(
      (entry) => Boolean(
        entry && typeof entry === "object" && typeof entry.url === "string"
      )
    ) : [];
  }
  function finiteInteger(value, fallback, minimum) {
    return Number.isFinite(value) ? Math.max(minimum, Math.trunc(value)) : fallback;
  }
  function finiteNumber(value, fallback) {
    return Number.isFinite(value) ? Number(value) : fallback;
  }
  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    let current = new Array(b.length + 1);
    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + cost
        );
      }
      [previous, current] = [current, previous];
    }
    return previous[b.length];
  }
  return __toCommonJS(index_exports);
})();
