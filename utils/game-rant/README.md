# Game Rant Airtable modules

Reusable Airtable Automation utilities for recovering Game Rant article URLs and ingesting saved Game Rant HTML.

The canonical source is TypeScript ESM. GitHub Actions publishes Airtable-safe IIFE bundles to the repository's `iife` branch after relevant changes reach `main`.

## Remote IIFE loading

Published bundles:

- `https://raw.githubusercontent.com/attention-spa/airtable/iife/game-rant-backfill.js`
- `https://raw.githubusercontent.com/attention-spa/airtable/iife/game-rant-ingest.js`

Airtable Automation can load either bundle without `import` or `importScripts`:

```js
async function loadIife(url, globalName, fetchMethod = fetch) {
  const response = await fetchMethod(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }

  const source = await response.text();
  return new Function(`${source}\nreturn ${globalName};`)();
}
```

## Backfill missing Game Rant links

The backfill module accepts Airtable table/field/view references by name or ID. A view is optional; even when supplied, only records whose URL cell is empty are candidates.

```js
const { backfillGameRantLinks } = await loadIife(
  "https://raw.githubusercontent.com/attention-spa/airtable/iife/game-rant-backfill.js",
  "gameRantBackfillModule",
);

const result = await backfillGameRantLinks({
  base,
  fetch: remoteFetchAsync,
  table: "Log",
  view: "missingLinks",
  fields: {
    url: "link",
    attachments: "html attachment",
  },

  authorSlug: "dominik-bosnjak",
  maxPagesToFetch: 40,
  startingPageNumber: 1,
  maxSearchFallbacks: 150,
  fetchConcurrency: 5,
  maxUpdatesPerRun: 200,
  fuzzyThreshold: 0.86,
  fuzzyMargin: 0.04,
  searchThreshold: 0.80,
});

console.info(result);
```

Matching order is exact normalized title, conservative fuzzy title, then Game Rant search fallback. Existing URLs are treated as reserved so the same canonical article URL is not assigned twice.

Every successful match updates both configured fields. For example:

```text
https://gamerant.com/gta-6-jason-lead-voice-actor-leak-grand-theft-auto/
```

becomes an attachment with the same URL and filename:

```text
gamerant.com gta-6-jason-lead-voice-actor-leak-grand-theft-auto.html
```

Airtable mutations are written in batches of at most 50 records.

## Ingest Game Rant HTML attachments

```js
const { ingestGameRantHtmlAttachments } = await loadIife(
  "https://raw.githubusercontent.com/attention-spa/airtable/iife/game-rant-ingest.js",
  "gameRantIngestModule",
);

const result = await ingestGameRantHtmlAttachments({
  base,
  table: "Log",
  view: "missingText", // optional
  fields: {
    attachments: "html attachment",
    html: "bodyhtml",
    md: "bodymd",
    metadata: "metadata", // optional
  },
  fetch: remoteFetchAsync, // optional; defaults to global fetch
  deleteAttachmentsAfterParsing: true,
});

console.info(result);
```

For every selected record the module finds an `.html`/`.htm` attachment, preferring filenames containing `gamerant.com`. Fetch promises are created in groups of 50 before parsing begins. Successful records receive:

- the inner HTML of the Game Rant `articleBody` container in the configured HTML field;
- a dependency-free Markdown conversion in the configured Markdown field;
- optional metadata parsed from `<meta>` elements and `VALNET_GLOBAL_*` script variables.

The source HTML attachment is removed only after that record parses successfully when `deleteAttachmentsAfterParsing` is enabled. Other attachments are preserved. Failed fetches or parses leave the source attachment untouched and are returned in `result.failed`.

### Metadata shape

Open Graph's `og:` prefix is removed, while namespaces such as `article`, `twitter`, and `fb` are retained. Nested suffixes remain nested. A repeated scalar/object path such as `og:image` plus `og:image:width` becomes an object with a `value` property:

```json
{
  "description": "A Steam MMO is officially confirmed to be shutting down...",
  "title": "Steam MMO Is Permanently Shutting Down on December 18",
  "locale": "en_US",
  "image": {
    "value": "https://static0.gamerantimages.com/...",
    "width": "1600",
    "height": "900"
  },
  "article": {
    "published_time": "2026-10-23T00:00:16Z",
    "author": "Dominik Bošnjak"
  },
  "twitter": {
    "creator": "@dddominikk"
  },
  "VALNET_GLOBAL_VARS": {
    "sreditor": "dalton",
    "flaggedwords": []
  }
}
```

`multilineText` metadata fields receive pretty-printed JSON directly. `richText` metadata fields receive the same JSON inside a fenced code block.

`VALNET_GLOBAL_*` values are parsed as literals without evaluating page JavaScript. Strings, booleans, numbers, `null`, and valid JSON arrays/objects are preserved as their corresponding JavaScript values; unsupported expressions are stored as source text.

## Local bundles

The root `tsup` configuration can build either module directly:

```sh
npm run bundle -- utils/game-rant/backfill/index.ts --format iife --global-name gameRantBackfillModule
npm run bundle -- utils/game-rant/ingest/index.ts --format iife --global-name gameRantIngestModule
```

Each command writes `dist/bundle.js`; the publish workflow renames those artifacts on the `iife` branch.
