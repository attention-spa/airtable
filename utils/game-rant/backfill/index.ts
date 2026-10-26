import {
  type AirtableBaseLike,
  type AirtableRecordLike,
  type AttachmentValue,
  type FetchLike,
  decodeHtmlEntities,
  parseHtmlAttributes,
  resolveField,
  resolveTable,
  resolveView,
  stripHtmlTags,
  toAttachmentWriteValue,
  updateRecordsInBatches,
} from "../shared.ts";

export type BackfillGameRantLinksConfig = {
  base: AirtableBaseLike;
  fetch: FetchLike;
  table: string;
  view?: string;
  fields: {
    url: string;
    attachments: string;
  };
  authorSlug?: string;
  startingPageNumber?: number;
  maxPagesToFetch?: number;
  maxSearchFallbacks?: number;
  fetchConcurrency?: number;
  maxUpdatesPerRun?: number;
  fuzzyThreshold?: number;
  fuzzyMargin?: number;
  searchThreshold?: number;
};

export type BackfillGameRantLinksResult = {
  missingAtStart: number;
  candidatesFromAuthorPages: number;
  updated: number;
  exactMatches: number;
  fuzzyMatches: number;
  searchMatches: number;
  unresolved: number;
  unresolvedRecords: { id: string; name: string }[];
};

type CandidateArticle = {
  href: string;
  path: string;
  title: string;
};

export async function backfillGameRantLinks(
  config: BackfillGameRantLinksConfig,
): Promise<BackfillGameRantLinksResult> {
  const table = resolveTable(config.base, config.table);
  const view = resolveView(table, config.view);
  const urlField = resolveField(table, config.fields.url);
  const attachmentField = resolveField(table, config.fields.attachments);

  if (attachmentField.type !== "multipleAttachments") {
    throw new TypeError(
      `Attachment field ${attachmentField.name} must be multipleAttachments.`,
    );
  }

  if (
    !["url", "singleLineText", "multilineText", "richText"].includes(
      urlField.type,
    )
  ) {
    throw new TypeError(
      `URL field ${urlField.name} must be a text-like or URL field.`,
    );
  }

  const source = view ?? table;
  const selected = await source.selectRecordsAsync({
    fields: [urlField.id, attachmentField.id],
  });

  const missing = selected.records.filter(
    (record) => !record.getCellValueAsString(urlField.id).trim(),
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
      unresolvedRecords: [],
    };
  }

  const allRecords = await table.selectRecordsAsync({ fields: [urlField.id] });
  const existingPaths = new Set<string>();
  for (const record of allRecords.records) {
    const canonical = canonicalGameRantUrl(
      record.getCellValueAsString(urlField.id),
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
  const authorSlug = (config.authorSlug || "dominik-bosnjak")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  const updates: { id: string; fields: Record<string, unknown> }[] = [];
  const matchedIds = new Set<string>();
  const stats = {
    exactMatches: 0,
    fuzzyMatches: 0,
    searchMatches: 0,
  };

  const queueMatch = (
    record: AirtableRecordLike,
    article: CandidateArticle,
    type: keyof typeof stats,
    score = 1,
  ): boolean => {
    if (matchedIds.has(record.id) || updates.length >= maxUpdatesPerRun) {
      return false;
    }

    const canonical = canonicalGameRantUrl(article.path);
    if (!canonical || existingPaths.has(canonical)) return false;

    const currentAttachments = normalizeAttachments(
      record.getCellValue(attachmentField.id),
    );
    const filename = gameRantHtmlFilename(canonical);
    const hasAttachment = currentAttachments.some(
      (attachment) =>
        attachment.filename?.toLowerCase() === filename.toLowerCase(),
    );

    updates.push({
      id: record.id,
      fields: {
        [urlField.id]: canonical,
        [attachmentField.id]: hasAttachment
          ? toAttachmentWriteValue(currentAttachments)
          : [
              ...toAttachmentWriteValue(currentAttachments),
              { url: canonical, filename },
            ],
      },
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
      attachmentFilename: filename,
    });

    return true;
  };

  const pageNumbers = Array.from(
    { length: maxPagesToFetch },
    (_, index) => startingPageNumber + index,
  );

  const authorPageResults = await mapWithConcurrency(
    pageNumbers,
    fetchConcurrency,
    async (pageNumber) => {
      const url =
        pageNumber > 1
          ? `https://gamerant.com/author/${authorSlug}/page/${pageNumber}/`
          : `https://gamerant.com/author/${authorSlug}/`;
      const html = await fetchText(config.fetch, url);
      return extractArticleLinks(html);
    },
  );

  const allPages = dedupeArticles(authorPageResults.flat());
  const recordsByTitle = new Map<string, AirtableRecordLike[]>();

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
      (candidate) => !matchedIds.has(candidate.id),
    );
    if (record) queueMatch(record, article, "exactMatches");
  }

  for (const record of missing.filter((value) => !matchedIds.has(value.id))) {
    if (updates.length >= maxUpdatesPerRun) break;
    const scored = allPages
      .filter((article) => !existingPaths.has(article.path))
      .map((article) => ({
        article,
        score: titleSimilarity(record.name, article.title),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) continue;
    const second = scored[1];
    const margin = second ? best.score - second.score : 1;

    if (
      best.score >= fuzzyThreshold &&
      (best.score >= 0.94 || margin >= fuzzyMargin)
    ) {
      queueMatch(record, best.article, "fuzzyMatches", best.score);
    }
  }

  const unresolvedForSearch = missing
    .filter((record) => !matchedIds.has(record.id))
    .slice(0, maxSearchFallbacks);

  const searchResults = await mapWithConcurrency(
    unresolvedForSearch,
    fetchConcurrency,
    async (record) => ({
      record,
      results: await gameRantSearch(record.name, config.fetch),
    }),
  );

  for (const { record, results } of searchResults) {
    if (updates.length >= maxUpdatesPerRun) break;
    if (matchedIds.has(record.id)) continue;

    const scored = results
      .filter((article) => !existingPaths.has(article.path))
      .map((article) => ({
        article,
        score: titleSimilarity(record.name, article.title),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) continue;
    const second = scored[1];
    const margin = second ? best.score - second.score : 1;

    if (
      best.score >= searchThreshold &&
      (best.score >= 0.93 || margin >= fuzzyMargin)
    ) {
      queueMatch(record, best.article, "searchMatches", best.score);
    }
  }

  if (updates.length) {
    await updateRecordsInBatches(table, updates, 50);
  }

  const unresolvedRecords = missing
    .filter((record) => !matchedIds.has(record.id))
    .map((record) => ({ id: record.id, name: record.name }));

  return {
    missingAtStart: missing.length,
    candidatesFromAuthorPages: allPages.length,
    updated: updates.length,
    ...stats,
    unresolved: unresolvedRecords.length,
    unresolvedRecords,
  };
}

export function canonicalGameRantUrl(href: unknown): string | null {
  if (!href) return null;

  let url: URL;
  try {
    url = new URL(String(href), "https://gamerant.com");
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "gamerant.com") return null;

  const pathname = url.pathname.startsWith("/")
    ? url.pathname
    : `/${url.pathname}`;

  if (/^\/(?:db|author|tag|category|search|page)(?:\/|$)/i.test(pathname)) {
    return null;
  }

  if (
    /^\/(?:terms-of-use|privacy-policy|dmca-take-down-policy|press-kit|fact-checking-policy|corrections-policy|ethics-policy|ownership-funding-advertising-policy)(?:\/|$)/i.test(
      pathname,
    )
  ) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1 || !segments[0].includes("-")) return null;
  return `https://gamerant.com/${segments[0]}/`;
}

export function gameRantHtmlFilename(urlValue: string): string {
  const url = new URL(urlValue);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  const pathWithSpaces = path.replace(/\//g, " ");
  return `${hostname}${pathWithSpaces ? ` ${pathWithSpaces}` : ""}.html`;
}

export function normTitle(value: unknown): string {
  if (!value) return "";
  return decodeHtmlEntities(String(value))
    .replace(/(?:\s*\[[^\]]*\]\s*)+$/gi, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleSimilarity(a: unknown, b: unknown): number {
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
  const tokenDice =
    aTokens.size + bTokens.size
      ? (2 * shared) / (aTokens.size + bTokens.size)
      : 0;
  return levenshteinScore * 0.7 + tokenDice * 0.3;
}

export function extractArticleLinks(html: string): CandidateArticle[] {
  const found = new Map<string, CandidateArticle>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;

  for (const match of String(html).matchAll(anchorPattern)) {
    const attrs = parseHtmlAttributes(match[1] ?? "");
    const href = attrs.href;
    const path = canonicalGameRantUrl(href);
    if (!path) continue;

    const title =
      cleanDisplayTitle(attrs.title) ||
      cleanDisplayTitle(stripHtmlTags(match[2] ?? ""));
    if (!title) continue;

    const previous = found.get(path);
    if (
      !previous ||
      normTitle(title).length > normTitle(previous.title).length
    ) {
      found.set(path, { href, path, title });
    }
  }

  return [...found.values()];
}

async function gameRantSearch(
  query: string,
  fetchMethod: FetchLike,
): Promise<CandidateArticle[]> {
  const encoded = encodeURIComponent(String(query).trim()).replace(/%20/g, "+");
  const html = await fetchText(
    fetchMethod,
    `https://gamerant.com/search/?q=${encoded}`,
  );
  return extractArticleLinks(html);
}

async function fetchText(fetchMethod: FetchLike, url: string): Promise<string> {
  try {
    const response = await fetchMethod(url);
    if (response?.ok === false) {
      console.warn({ url, status: response.status });
    }
    return await response.text();
  } catch (error) {
    console.error({
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

function cleanDisplayTitle(value: unknown): string {
  return value
    ? decodeHtmlEntities(String(value)).replace(/\s+/g, " ").trim()
    : "";
}

function dedupeArticles(
  articles: readonly CandidateArticle[],
): CandidateArticle[] {
  const byPath = new Map<string, CandidateArticle>();
  for (const article of articles) {
    if (!article?.path) continue;
    const previous = byPath.get(article.path);
    if (
      !previous ||
      normTitle(article.title).length > normTitle(previous.title).length
    ) {
      byPath.set(article.path, article);
    }
  }
  return [...byPath.values()];
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, limit), items.length) },
      () => worker(),
    ),
  );
  return results;
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

function finiteInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
): number {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.trunc(value as number))
    : fallback;
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length];
}
