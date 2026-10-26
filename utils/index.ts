export { selectFullRecordsAsync } from "./selectFullRecordsAsync/index.ts";
export { SmartBase } from "./smart-base/index.ts";
export { default as remoteBase, createRemoteBase } from "./remote-base/index.ts";
export {
  chunk,
  runInBatches,
  MutationLimiter,
  OperationLimiter,
  createReferenceIndex,
  normalizeRef,
  resolveReference,
} from "./core/index.ts";
export type { AirtableNamedReference } from "./core/index.ts";
export {
  backfillGameRantLinks,
  canonicalGameRantUrl,
  extractArticleLinks,
  gameRantHtmlFilename,
  normTitle,
  titleSimilarity,
} from "./game-rant/backfill/index.ts";
export type {
  BackfillGameRantLinksConfig,
  BackfillGameRantLinksResult,
} from "./game-rant/backfill/index.ts";
export {
  extractArticleBodyHtml,
  extractGameRantMetadata,
  extractMetaTags,
  extractValnetGlobalVars,
  findGameRantHtmlAttachment,
  htmlToMarkdown,
  ingestGameRantHtmlAttachments,
  serializeMetadataForField,
} from "./game-rant/ingest/index.ts";
export type {
  IngestGameRantHtmlConfig,
  IngestGameRantHtmlResult,
} from "./game-rant/ingest/index.ts";
