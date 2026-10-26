import { describe, expect, it } from "vitest";
import {
  canonicalGameRantUrl,
  extractArticleLinks,
  gameRantHtmlFilename,
  titleSimilarity,
  backfillGameRantLinks,
} from "./backfill/index.ts";
import {
  extractArticleBodyHtml,
  extractGameRantMetadata,
  findGameRantHtmlAttachment,
  htmlToMarkdown,
  ingestGameRantHtmlAttachments,
  serializeMetadataForField,
} from "./ingest/index.ts";
import type {
  AirtableBaseLike,
  AirtableFieldLike,
  AirtableRecordLike,
  AirtableTableLike,
} from "./shared.ts";

function field(id: string, name: string, type: string): AirtableFieldLike {
  return { id, name, type };
}

function record(
  id: string,
  name: string,
  initial: Record<string, unknown>,
): AirtableRecordLike & { cells: Map<string, unknown> } {
  const cells = new Map(Object.entries(initial));
  return {
    id,
    name,
    cells,
    getCellValue(ref: unknown) {
      const key = typeof ref === "string"
        ? ref
        : (ref as { id: string }).id;
      return cells.get(key);
    },
    getCellValueAsString(ref: unknown) {
      const value = this.getCellValue(ref);
      if (value == null) return "";
      if (Array.isArray(value)) {
        return value
          .map((entry) =>
            typeof entry === "object" && entry
              ? String((entry as { filename?: string }).filename ?? "")
              : String(entry))
          .join(", ");
      }
      return String(value);
    },
  };
}

function tableFixture(
  records: Array<AirtableRecordLike & { cells: Map<string, unknown> }>,
  fields: AirtableFieldLike[],
): AirtableTableLike & {
  updates: Array<{ id: string; fields: Record<string, unknown> }>;
} {
  const updates: Array<{ id: string; fields: Record<string, unknown> }> = [];
  return {
    id: "tblLog",
    name: "Log",
    fields,
    views: [],
    updates,
    async selectRecordsAsync() {
      return { records };
    },
    async updateRecordsAsync(batch) {
      updates.push(...batch);
      for (const update of batch) {
        const target = records.find((candidate) => candidate.id === update.id);
        for (const [fieldId, value] of Object.entries(update.fields)) {
          target?.cells.set(fieldId, value);
        }
      }
    },
  };
}

const sampleHtml = `<!doctype html><html><head>
<meta name="description" content="Desc &amp; more"/>
<meta property="og:title" content="Steam MMO Is Permanently Shutting Down on December 18"/>
<meta property="og:image" content="https://img.test/a.jpg?w=1600&amp;h=900"/>
<meta property="og:image:width" content="1600"/>
<meta property="og:image:height" content="900"/>
<meta property="og:locale" content="en_US"/>
<meta property="article:published_time" content="2026-10-23T00:00:16Z"/>
<meta name="twitter:creator" content="@dddominikk"/>
<script>
var VALNET_GLOBAL_SREDITOR = "dalton";
var VALNET_GLOBAL_FLAGGEDWORDS = [];
var VALNET_GLOBAL_ENABLED = true;
</script></head><body>
<section class="article-body"><p>Hello <strong>world</strong>.</p><h2>Next</h2><p><a href="https://example.com">Link</a></p></section>
</body></html>`;

describe("Game Rant helpers", () => {
  it("canonicalizes article URLs and rejects database URLs", () => {
    expect(
      canonicalGameRantUrl(
        "https://www.gamerant.com/gta-6-jason-lead-voice-actor-leak-grand-theft-auto/?x=1",
      ),
    ).toBe(
      "https://gamerant.com/gta-6-jason-lead-voice-actor-leak-grand-theft-auto/",
    );
    expect(canonicalGameRantUrl("https://gamerant.com/db/video-game/gta-6/"))
      .toBeNull();
  });

  it("derives the requested HTML attachment filename", () => {
    expect(
      gameRantHtmlFilename(
        "https://gamerant.com/gta-6-jason-lead-voice-actor-leak-grand-theft-auto/",
      ),
    ).toBe(
      "gamerant.com gta-6-jason-lead-voice-actor-leak-grand-theft-auto.html",
    );
  });

  it("extracts article links without depending on anchor classes", () => {
    const links = extractArticleLinks(
      `<a class="card" href="/steam-mmo-shutting-down/" title="Steam MMO Is Shutting Down">Story</a>` +
      `<a href="https://gamerant.com/db/video-game/foo/">DB</a>`,
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.path).toBe("https://gamerant.com/steam-mmo-shutting-down/");
    expect(titleSimilarity("Foo’s Game: Update [EXCLUSIVE]", "FOO'S GAME — UPDATE"))
      .toBeGreaterThan(0.99);
  });

  it("extracts article body, metadata, VALNET vars, and Markdown", () => {
    const body = extractArticleBodyHtml(sampleHtml);
    expect(body).toContain("Hello");
    expect(body).toContain("<h2>Next</h2>");

    const metadata = extractGameRantMetadata(sampleHtml);
    expect(metadata).toMatchObject({
      description: "Desc & more",
      title: "Steam MMO Is Permanently Shutting Down on December 18",
      locale: "en_US",
      article: { published_time: "2026-10-23T00:00:16Z" },
      twitter: { creator: "@dddominikk" },
      VALNET_GLOBAL_VARS: {
        sreditor: "dalton",
        flaggedwords: [],
        enabled: true,
      },
    });
    expect(metadata.image).toEqual({
      value: "https://img.test/a.jpg?w=1600&h=900",
      width: "1600",
      height: "900",
    });

    const markdown = htmlToMarkdown(body ?? "");
    expect(markdown).toContain("Hello **world**.");
    expect(markdown).toContain("## Next");
    expect(markdown).toContain("[Link](https://example.com)");
    expect(serializeMetadataForField(metadata, { type: "richText" }))
      .toMatch(/^```\n\{/);
  });
});

describe("Game Rant Airtable flows", () => {
  it("backfills an empty URL and adds the same article as an HTML attachment", async () => {
    const urlField = field("fldUrl", "link", "url");
    const attachmentField = field("fldAtt", "html attachment", "multipleAttachments");
    const row = record("rec1", "Steam MMO Is Shutting Down", {
      fldUrl: "",
      fldAtt: [],
    });
    const table = tableFixture([row], [urlField, attachmentField]);
    const base: AirtableBaseLike = { tables: [table] };

    const result = await backfillGameRantLinks({
      base,
      fetch: async (url) => ({
        ok: true,
        status: 200,
        async text() {
          return url.includes("/author/")
            ? `<a href="/steam-mmo-shutting-down/" title="Steam MMO Is Shutting Down">Story</a>`
            : "";
        },
      }),
      table: "tblLog",
      fields: { url: "link", attachments: "fldAtt" },
      maxPagesToFetch: 1,
      maxSearchFallbacks: 0,
    });

    expect(result.updated).toBe(1);
    expect(table.updates[0]?.fields).toEqual({
      fldUrl: "https://gamerant.com/steam-mmo-shutting-down/",
      fldAtt: [{
        url: "https://gamerant.com/steam-mmo-shutting-down/",
        filename: "gamerant.com steam-mmo-shutting-down.html",
      }],
    });
  });

  it("loads an HTML attachment, writes body/Markdown/metadata, then removes the parsed source", async () => {
    const attachmentField = field("fldAtt", "attachments", "multipleAttachments");
    const htmlField = field("fldHtml", "bodyhtml", "multilineText");
    const mdField = field("fldMd", "bodymd", "richText");
    const metaField = field("fldMeta", "metadata", "richText");
    const sourceAttachment = {
      id: "attHtml",
      url: "https://airtableusercontent.example/page",
      filename: "gamerant.com steam-mmo-shutting-down.html",
    };
    const otherAttachment = {
      id: "attPdf",
      url: "https://airtableusercontent.example/other",
      filename: "notes.pdf",
    };
    const row = record("rec2", "Article", {
      fldAtt: [sourceAttachment, otherAttachment],
      fldHtml: "",
      fldMd: "",
      fldMeta: "",
    });
    const table = tableFixture(
      [row],
      [attachmentField, htmlField, mdField, metaField],
    );
    const base: AirtableBaseLike = { tables: [table] };

    const result = await ingestGameRantHtmlAttachments({
      base,
      table: "Log",
      fields: {
        attachments: "attachments",
        html: "bodyhtml",
        md: "bodymd",
        metadata: "metadata",
      },
      fetch: async () => ({ ok: true, status: 200, async text() { return sampleHtml; } }),
    });

    expect(result.updated).toBe(1);
    expect(table.updates[0]?.fields.fldHtml).toContain("Hello");
    expect(table.updates[0]?.fields.fldMd).toContain("**world**");
    expect(table.updates[0]?.fields.fldMeta).toMatch(/^```\n\{/);
    expect(table.updates[0]?.fields.fldAtt).toEqual([
      { url: otherAttachment.url, filename: otherAttachment.filename },
    ]);
  });

  it("does not delete an HTML attachment when article parsing fails", async () => {
    const attachmentField = field("fldAtt", "attachments", "multipleAttachments");
    const htmlField = field("fldHtml", "bodyhtml", "multilineText");
    const mdField = field("fldMd", "bodymd", "richText");
    const sourceAttachment = {
      id: "attHtml",
      url: "https://airtableusercontent.example/broken",
      filename: "gamerant.com broken.html",
    };
    const row = record("rec3", "Broken", {
      fldAtt: [sourceAttachment],
      fldHtml: "",
      fldMd: "",
    });
    const table = tableFixture([row], [attachmentField, htmlField, mdField]);
    const base: AirtableBaseLike = { tables: [table] };

    const result = await ingestGameRantHtmlAttachments({
      base,
      table: "Log",
      fields: { attachments: "attachments", html: "bodyhtml", md: "bodymd" },
      fetch: async () => ({
        ok: true,
        status: 200,
        async text() { return "<html><p>No article body wrapper</p></html>"; },
      }),
    });

    expect(result.updated).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(table.updates).toHaveLength(0);
    expect(findGameRantHtmlAttachment(row.getCellValue("fldAtt") as never[]))
      .toEqual(sourceAttachment);
  });
});
