var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/record-loader/loadRecord.ts
var loadRecord_exports = {};
__export(loadRecord_exports, {
  customAirtableRecordLoad: () => customAirtableRecordLoad
});
async function customAirtableRecordLoad(ops) {
  const {
    record,
    fields,
    dataParsers = [],
    includeCellValue = true,
    includeCellValueAsString = true,
    cellReaders = []
  } = ops;
  const customFormatsDefined = dataParsers.map((p) => p.format?.toLowerCase?.());
  const finalParsers = [
    ...dataParsers,
    ...defaultParsers.filter((p) => !customFormatsDefined.includes(p.format))
  ];
  const fullyLoadedFields = {};
  for (const field of fields) {
    const cellValue = record.getCellValue(field.id);
    const cellValueAsString = record.getCellValueAsString(field.id);
    const cell = { field };
    if (includeCellValue) {
      cell.value = cellValue;
    }
    if (includeCellValueAsString) {
      cell.valueAsString = cellValueAsString;
    }
    const matchingParser = finalParsers.find(
      (p) => p?.conditionsMatch?.({ field, record })
    );
    if (matchingParser) {
      cell.valueAsData = matchingParser.parse(cellValueAsString, { record, field });
    }
    for (const reader of cellReaders) {
      const matches = typeof reader?.condition === "function" ? reader.condition({ record, field }) : true;
      if (!matches || typeof reader?.read !== "function") continue;
      cell[reader.key] = await reader.read({
        record,
        field,
        cellValue,
        cellValueAsString
      });
    }
    fullyLoadedFields[field.name] = cell;
    Object.defineProperty(fullyLoadedFields, field.id, {
      get() {
        return fullyLoadedFields[field.name];
      },
      configurable: true
    });
  }
  return Object.assign(record, { fullFields: fullyLoadedFields });
}
var defaultParsers;
var init_loadRecord = __esm({
  "src/record-loader/loadRecord.ts"() {
    defaultParsers = [
      {
        format: "json",
        conditionsMatch: ({ record, field }) => {
          const checks = {
            dotJsonInFldOrRecName: [field.name, record.name].some(
              (s) => String(s).toLowerCase().endsWith(".json")
            ),
            supportedFldType: [
              "singleLineText",
              "multilineText",
              "richText",
              "formula"
            ].includes(field.type ?? ""),
            nonEmptyCell: record.getCellValueAsString(field.id)?.trim().length > 0
          };
          return !Object.values(checks).includes(false);
        },
        parse: (stringCellValue) => {
          try {
            return JSON.parse(stringCellValue);
          } catch (e) {
            return new Error(e instanceof Error ? e.message : String(e));
          }
        }
      }
    ];
  }
});

// src/airtable-types.ts
var airtable_types_exports = {};

// src/parser/index.ts
var parser_exports = {};
__export(parser_exports, {
  buildModuleParserMap: () => buildModuleParserMap,
  defaultParserMap: () => defaultParserMap,
  executeAsScript: () => executeAsScript,
  formatDependencies: () => formatDependencies,
  getCachedExternalModule: () => getCachedExternalModule,
  supportedFormats: () => supportedFormats,
  supportedModules: () => supportedModules,
  transpileAndExecute: () => transpileAndExecute,
  transpileAndImportTypeScript: () => transpileAndImportTypeScript
});

// src/parser/lib/json.ts
function parseJsonString(source) {
  return JSON.parse(source);
}
function parseJsonLines(source) {
  return source.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(
        `Failed to parse JSONL line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

// src/parser/lib/csv.ts
function parseCsvLine(line, delimiter = ",") {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
}
function parseCsv(source, delimiter = ",") {
  const lines = source.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return [];
  }
  const headers = parseCsvLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i] ?? `column_${i}`] = values[i] ?? "";
    }
    return row;
  });
}

// src/parser/config.ts
var formatDependencies = {
  yaml: {
    cdnUrl: "https://esm.sh/yaml"
  },
  "jsonc-parser": {
    cdnUrl: "https://esm.sh/jsonc-parser"
  },
  toml: {
    cdnUrl: "https://esm.sh/toml"
  },
  typescript: {
    cdnUrl: "https://esm.sh/typescript"
  }
};
var supportedFormats = [
  { key: "json", extensions: ["json"], mimeTypes: ["application/json"], depKeys: [] },
  { key: "jsonl", extensions: ["jsonl", "ndjson"], mimeTypes: ["application/x-ndjson", "application/jsonl"], depKeys: [] },
  { key: "jsonc", extensions: ["jsonc"], mimeTypes: ["application/jsonc"], depKeys: ["jsonc-parser"] },
  { key: "yaml", extensions: ["yaml", "yml"], mimeTypes: ["application/yaml", "text/yaml", "application/x-yaml"], depKeys: ["yaml"] },
  { key: "toml", extensions: ["toml"], mimeTypes: ["application/toml"], depKeys: ["toml"] },
  { key: "csv", extensions: ["csv"], mimeTypes: ["text/csv"], depKeys: [] },
  { key: "javascript", extensions: ["js", "mjs"], mimeTypes: ["application/javascript", "text/javascript"], depKeys: [] },
  { key: "typescript", extensions: ["ts", "tsx", "mts", "cts"], mimeTypes: ["application/typescript", "text/typescript"], depKeys: ["typescript"] },
  { key: "text", extensions: ["txt", "sql", "md"], mimeTypes: ["text/plain", "text/markdown", "text/x-sql", "application/sql"], depKeys: [] }
];
var supportedModules = [
  {
    type: "esm",
    compatibleFormats: ["javascript", "typescript"]
  },
  {
    type: "iife",
    compatibleFormats: ["javascript", "typescript"]
  },
  {
    type: "script",
    // TypeScript excluded — importScripts cannot execute raw TS
    compatibleFormats: ["javascript"]
  }
];

// src/parser/moduleCache.ts
function getRuntimeModuleCache() {
  if (!globalThis.__airtableScriptExtenderModuleCache) {
    globalThis.__airtableScriptExtenderModuleCache = {
      modules: /* @__PURE__ */ Object.create(null)
    };
  }
  return globalThis.__airtableScriptExtenderModuleCache;
}
async function getCachedExternalModule(key) {
  const cache = getRuntimeModuleCache();
  if (cache.modules[key]) {
    return cache.modules[key];
  }
  const dep = formatDependencies[key];
  if (!dep) {
    throw new Error(`No dependency registered for module key: "${key}"`);
  }
  const specifier = dep.localPath ?? dep.cdnUrl;
  const mod = await import(specifier);
  cache.modules[key] = mod;
  return mod;
}

// src/parser/lib/jsonc.ts
async function parseJsonc(source) {
  const jsonc = await getCachedExternalModule("jsonc-parser");
  const errors = [];
  const value = jsonc.parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false
  });
  if (errors.length) {
    throw new Error(`Failed to parse JSONC: ${JSON.stringify(errors)}`);
  }
  return value;
}

// src/parser/lib/yaml.ts
async function parseYaml(source) {
  const yaml = await getCachedExternalModule("yaml");
  return yaml.parse(source);
}

// src/parser/lib/toml.ts
async function parseToml(source) {
  const toml = await getCachedExternalModule("toml");
  return toml.parse(source);
}

// src/parser/lib/javascript.ts
function toJsDataUrl(source) {
  return `data:application/javascript;base64,${btoa(
    unescape(encodeURIComponent(source))
  )}`;
}
async function importJavaScriptModule(source) {
  return await import(toJsDataUrl(source));
}
async function executeAsIife(source) {
  const AsyncFunction = Object.getPrototypeOf(async function() {
  }).constructor;
  return await new AsyncFunction(source)();
}
function executeAsScript(url) {
  if (typeof importScripts !== "function") {
    throw new Error("executeAsScript is only available in Worker contexts (importScripts is not defined).");
  }
  importScripts(url);
}
function executeAsScriptFromText(source) {
  if (typeof importScripts !== "function") {
    throw new Error("executeAsScriptFromText is only available in Worker contexts (importScripts is not defined).");
  }
  const blob = new Blob([source], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    importScripts(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// src/parser/lib/typescript.ts
async function transpile(source) {
  const ts = await getCachedExternalModule("typescript");
  return typeof ts.transpileModule === "function" ? ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget && "ESNext" in ts.ScriptTarget && ts.ScriptTarget.ESNext || "ESNext",
      module: ts.ModuleKind && "ESNext" in ts.ModuleKind && ts.ModuleKind.ESNext || "ESNext",
      removeComments: true,
      esModuleInterop: true
    }
  }).outputText : typeof ts.transpile === "function" ? ts.transpile(source, {
    target: "esnext",
    module: "esnext",
    removeComments: true,
    esModuleInterop: true
  }) : source;
}
async function transpileAndExecute(source, moduleType = "esm") {
  const js = await transpile(source);
  switch (moduleType) {
    case "esm":
      return await importJavaScriptModule(js);
    case "iife":
      return await executeAsIife(js);
    case "script":
      return executeAsScriptFromText(js);
  }
}
async function transpileAndImportTypeScript(source) {
  return transpileAndExecute(source, "esm");
}

// src/parser/index.ts
var defaultParserMap = {
  json: (source) => parseJsonString(source),
  jsonl: (source) => parseJsonLines(source),
  ndjson: (source) => parseJsonLines(source),
  jsonc: (source) => parseJsonc(source),
  yaml: (source) => parseYaml(source),
  yml: (source) => parseYaml(source),
  toml: (source) => parseToml(source),
  csv: (source) => parseCsv(source),
  js: (source) => importJavaScriptModule(source),
  mjs: (source) => importJavaScriptModule(source),
  ts: (source) => transpileAndImportTypeScript(source),
  tsx: (source) => transpileAndImportTypeScript(source),
  mts: (source) => transpileAndImportTypeScript(source),
  cts: (source) => transpileAndImportTypeScript(source)
};
var jsExecutors = {
  esm: (source) => importJavaScriptModule(source),
  iife: (source) => executeAsIife(source),
  script: (source) => executeAsScriptFromText(source)
};
function buildModuleParserMap(moduleType) {
  const jsExec = jsExecutors[moduleType];
  const tsExec = moduleType === "script" ? null : (source) => transpileAndExecute(source, moduleType);
  const tsEntry = tsExec ? { ts: tsExec, tsx: tsExec, mts: tsExec, cts: tsExec } : {};
  return {
    ...defaultParserMap,
    js: jsExec,
    mjs: jsExec,
    ...tsEntry
  };
}

// src/attachment-loader/index.ts
var attachment_loader_exports = {};
__export(attachment_loader_exports, {
  buildAttachmentLoader: () => buildAttachmentLoader,
  buildAttachmentLoaderFromOptions: () => buildAttachmentLoaderFromOptions,
  getAttachmentExtension: () => getAttachmentExtension
});

// src/attachment-loader/loadAttachment.ts
function getAttachmentExtension(attachment) {
  const parts = String(attachment.filename ?? "").split(".");
  if (parts.length < 2) {
    return null;
  }
  return parts.at(-1)?.toLowerCase() ?? null;
}
function buildMimeParserMap(parserMap) {
  const map = {};
  for (const format of supportedFormats) {
    if (!parserMap[format.extensions[0]]) continue;
    for (const mime of format.mimeTypes) {
      map[mime.toLowerCase()] = format.extensions[0];
    }
  }
  return map;
}
function resolveParserKey(attachment, mimeParserMap) {
  const mime = typeof attachment.type === "string" ? attachment.type.toLowerCase().split(";")[0].trim() : null;
  if (mime && mimeParserMap[mime]) {
    return mimeParserMap[mime];
  }
  return getAttachmentExtension(attachment);
}
function buildAttachmentLoader(fetchMethod, parserMap = defaultParserMap) {
  const mimeParserMap = buildMimeParserMap(parserMap);
  return async function loadAttachmentContent(attachment) {
    const key = resolveParserKey(attachment, mimeParserMap);
    const response = await fetchMethod(attachment.url);
    const parser = key !== null ? parserMap[key] : void 0;
    if (parser) {
      const text = await response.text();
      return await parser(text);
    }
    return await response.text();
  };
}
function buildAttachmentLoaderFromOptions(options) {
  return buildAttachmentLoader(options.fetchMethod, options.parserMap);
}

// src/cell-reader/index.ts
var cell_reader_exports = {};
__export(cell_reader_exports, {
  defaultCellValueGetters: () => defaultCellValueGetters,
  defaultGetterChecks: () => defaultGetterChecks,
  defaultGetterModes: () => defaultGetterModes,
  defaultGetterRegistry: () => defaultGetterRegistry,
  evaluateGetterMode: () => evaluateGetterMode,
  resolveGetterModeSelection: () => resolveGetterModeSelection
});

// src/cell-reader/lib/checks.ts
var defaultGetterChecks = {
  fieldNameEndsWithApplicationJson: ({ field }) => field.name.toLowerCase().endsWith(".application.json"),
  fieldNameEndsWithApplicationJsonl: ({ field }) => field.name.toLowerCase().endsWith(".application.jsonl"),
  isMultipleAttachmentsField: ({ field }) => field.type === "multipleAttachments",
  isLongTextLikeField: ({ field }) => ["singleLineText", "multilineText", "richText", "formula"].includes(field.type)
};

// src/cell-reader/lib/modes.ts
var defaultGetterModes = {
  jsonByFieldName: {
    all: ["fieldNameEndsWithApplicationJson"]
  },
  jsonlByFieldName: {
    all: ["fieldNameEndsWithApplicationJsonl"]
  },
  attachmentsByFieldType: {
    all: ["isMultipleAttachmentsField"]
  }
};

// src/cell-reader/lib/getters.ts
function defaultCellValueGetters(options = {}) {
  const { attachmentContentLoader } = options;
  return {
    json: {
      key: "json",
      needs: ["string"],
      defaultMode: "jsonByFieldName",
      get: ({ reads }) => JSON.parse(reads.string ?? "")
    },
    jsonl: {
      key: "jsonl",
      needs: ["string"],
      defaultMode: "jsonlByFieldName",
      get: ({ reads }) => (reads.string ?? "").split(/\r?\n/g).map((line) => line.trim()).filter(Boolean).map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(
            `Failed to parse JSONL line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      })
    },
    attachments: {
      key: "attachments",
      needs: ["value"],
      defaultMode: "attachmentsByFieldType",
      get: async ({ reads }) => {
        const attachments = Array.isArray(reads.value) ? reads.value : [];
        const loaded = [];
        for (const attachment of attachments) {
          const ext = getAttachmentExtension(attachment);
          const entry = { ...attachment, ext };
          if (attachmentContentLoader) {
            try {
              entry.content = await attachmentContentLoader(attachment);
            } catch (error) {
              entry.loadError = error instanceof Error ? error.message : String(error);
            }
          }
          loaded.push(entry);
        }
        return loaded;
      }
    }
  };
}

// src/cell-reader/evaluateGetterMode.ts
async function runNamedChecks(names, checks, context, aggregator) {
  if (!names?.length) {
    return aggregator === "every";
  }
  const results = await Promise.all(
    names.map(async (name) => {
      const check = checks[name];
      if (typeof check !== "function") {
        return false;
      }
      return await check(context);
    })
  );
  return aggregator === "every" ? results.every(Boolean) : results.some(Boolean);
}
async function evaluateGetterMode(mode, checks, context) {
  if (!mode) {
    return false;
  }
  const [allPass, anyPass, nonePass] = await Promise.all([
    runNamedChecks(mode.all, checks, context, "every"),
    mode.any?.length ? runNamedChecks(mode.any, checks, context, "some") : Promise.resolve(true),
    mode.none?.length ? runNamedChecks(mode.none, checks, context, "some").then((result) => !result) : Promise.resolve(true)
  ]);
  return allPass && anyPass && nonePass;
}

// src/cell-reader/resolveGetterMode.ts
function resolveGetterModeSelection(getter, fieldOverrides, queryOrLoaderDefaults, modes) {
  const explicit = fieldOverrides?.[getter.key] ?? queryOrLoaderDefaults?.[getter.key] ?? getter.defaultMode;
  if (explicit === null) {
    return null;
  }
  if (typeof explicit === "string") {
    return modes[explicit] ?? null;
  }
  return explicit;
}

// src/cell-reader/index.ts
function defaultGetterRegistry(options = {}) {
  return {
    checks: { ...defaultGetterChecks },
    modes: { ...defaultGetterModes },
    getters: defaultCellValueGetters(options)
  };
}

// src/record-loader/index.ts
var record_loader_exports = {};
__export(record_loader_exports, {
  customAirtableRecordLoad: () => customAirtableRecordLoad,
  getSelectedFields: () => getSelectedFields,
  loadPrimitiveCellReads: () => loadPrimitiveCellReads,
  loadRecordModel: () => loadRecordModel,
  selectFullRecordsAsync: () => selectFullRecordsAsync,
  selectTableRecords: () => selectTableRecords
});

// src/record-loader/getSelectedFields.ts
function normalizeFieldSelectionValue(value) {
  if (value === true) {
    return { value: true, string: true };
  }
  if (typeof value === "string") {
    return {
      getters: {
        [value]: value
      }
    };
  }
  if (Array.isArray(value)) {
    return {
      getters: Object.fromEntries(value.map((key) => [key, key]))
    };
  }
  return {
    value: value.value,
    string: value.string,
    getters: value.getters
  };
}
function getSelectedFields(table, fields) {
  if (!fields || fields === "*") {
    return table.fields.map((field) => ({
      field,
      config: { value: true, string: true }
    }));
  }
  if (Array.isArray(fields)) {
    const wanted = new Set(fields.map((fieldName) => fieldName.toLowerCase()));
    return table.fields.filter(
      (field) => wanted.has(field.name.toLowerCase()) || wanted.has(field.id.toLowerCase())
    ).map((field) => ({
      field,
      config: { value: true, string: true }
    }));
  }
  const fieldMap = fields;
  return Object.entries(fieldMap).map(([key, value]) => {
    const field = table.fields.find(
      (candidate) => candidate.name.toLowerCase() === key.toLowerCase() || candidate.id.toLowerCase() === key.toLowerCase()
    );
    if (!field) {
      return null;
    }
    return {
      field,
      config: normalizeFieldSelectionValue(value)
    };
  }).filter((entry) => Boolean(entry));
}

// src/record-loader/loadPrimitiveCellReads.ts
function loadPrimitiveCellReads(record, field, needs) {
  const reads = {};
  const uniqueNeeds = new Set(needs);
  if (uniqueNeeds.has("value")) {
    reads.value = record.getCellValue(field);
  }
  if (uniqueNeeds.has("string")) {
    reads.string = record.getCellValueAsString(field);
  }
  return reads;
}

// src/record-loader/loadRecordModel.ts
async function loadRecordModel(params) {
  const { base: base2, table, record, registry, query, defaultGetterModes: defaultGetterModes2 } = params;
  const primitivePolicy = query?.primitivePolicy ?? "minimal";
  const selectedFields = getSelectedFields(table, query?.fields);
  const loaded = {
    id: record.id,
    name: record.name,
    record,
    table: { id: table.id, name: table.name },
    cells: {
      values: {},
      strings: {},
      getters: Object.fromEntries(
        Object.keys(registry.getters).map((key) => [key, {}])
      )
    }
  };
  for (const entry of selectedFields) {
    const { field, config } = entry;
    const activeGetterEntries = [];
    for (const getter of Object.values(registry.getters)) {
      const mode = resolveGetterModeSelection(
        getter,
        config.getters,
        query?.getterModes ?? defaultGetterModes2,
        registry.modes
      );
      const matches = await evaluateGetterMode(mode, registry.checks, {
        field,
        record,
        table,
        base: base2
      });
      if (matches) {
        activeGetterEntries.push({ getter });
      }
    }
    const primitiveNeeds = /* @__PURE__ */ new Set();
    if (primitivePolicy === "full" || config.value) {
      primitiveNeeds.add("value");
    }
    if (primitivePolicy === "full" || config.string) {
      primitiveNeeds.add("string");
    }
    for (const { getter } of activeGetterEntries) {
      for (const need of getter.needs) {
        primitiveNeeds.add(need);
      }
    }
    const reads = loadPrimitiveCellReads(record, field, primitiveNeeds);
    if (primitiveNeeds.has("value")) {
      loaded.cells.values[field.name] = reads.value;
    }
    if (primitiveNeeds.has("string")) {
      loaded.cells.strings[field.name] = reads.string ?? "";
    }
    for (const { getter } of activeGetterEntries) {
      loaded.cells.getters[getter.key][field.name] = await getter.get({
        field,
        record,
        table,
        base: base2,
        reads
      });
    }
  }
  return loaded;
}

// src/record-loader/selectTableRecords.ts
async function selectTableRecords(params) {
  const { base: base2, table, query, registry, defaultGetterModes: defaultGetterModes2 } = params;
  const selectedFields = getSelectedFields(table, query?.fields).map((entry) => entry.field);
  const result = await table.selectRecordsAsync({
    recordIds: query?.recordIds,
    fields: selectedFields.length ? selectedFields : void 0,
    view: query?.view
  });
  const records = [];
  for (const record of result.records) {
    records.push(
      await loadRecordModel({
        base: base2,
        table,
        record,
        registry,
        query,
        defaultGetterModes: defaultGetterModes2
      })
    );
  }
  return { table, records };
}

// src/record-loader/index.ts
init_loadRecord();

// src/record-loader/selectRecords.ts
async function loadCustomAirtableRecordLoad() {
  return Promise.resolve().then(() => (init_loadRecord(), loadRecord_exports));
}
async function selectFullRecordsAsync(root, options = {}) {
  const thisBase = this?.base ?? (typeof base !== "undefined" ? base : void 0);
  const {
    recordIds,
    fields: fieldsToLoad,
    includeCellValue = true,
    includeCellValueAsString = false,
    cellReaders = [],
    dataParsers = [],
    useCustomAirtableRecordLoad = false,
    recordModel
  } = options;
  const B = !!thisBase && typeof thisBase === "object" ? thisBase : this?.base ?? new TypeError(`The base object isn't available.`);
  const table = root.id.startsWith("tbl") ? root : B.tables.find(
    (t) => t.id === new RegExp(String.raw`\b(?<tblId>tbl\w{14})\b`, "i").exec(root.url)?.groups?.tblId
  );
  const fields = fieldsToLoad ? table.fields.filter(
    (f) => fieldsToLoad.some(
      (x) => [f.name, f.id].map((y) => String(y).toLowerCase()).includes(String(x).toLowerCase())
    )
  ) : table.fields;
  const queryResult = await root.selectRecordsAsync({ recordIds, fields });
  const customLoader = useCustomAirtableRecordLoad ? (await loadCustomAirtableRecordLoad()).customAirtableRecordLoad : null;
  const results = [];
  for (const record of queryResult.records) {
    let loadedFieldMap;
    if (customLoader) {
      const loaded = await customLoader({
        record,
        fields,
        dataParsers,
        includeCellValue,
        includeCellValueAsString,
        cellReaders
      });
      loadedFieldMap = loaded.fullFields;
    } else {
      loadedFieldMap = Object.fromEntries(
        await Promise.all(
          fields.map(async (field) => {
            const cellValue = record.getCellValue(field.id);
            const cellValueAsString = record.getCellValueAsString(field.id);
            const payload = { field };
            if (includeCellValue) {
              payload.value = cellValue;
            }
            if (includeCellValueAsString) {
              payload.valueAsString = cellValueAsString;
            }
            for (const reader of cellReaders) {
              const matches = typeof reader?.condition === "function" ? reader.condition({ record, field }) : true;
              if (!matches || typeof reader?.read !== "function") continue;
              payload[reader.key] = await reader.read({
                record,
                field,
                cellValue,
                cellValueAsString
              });
            }
            return [field.name, payload];
          })
        )
      );
    }
    const built = typeof recordModel === "function" ? await recordModel({
      record,
      fields,
      loadedFieldMap,
      table,
      root
    }) : Object.assign(record, { fields: loadedFieldMap });
    results.push(built);
  }
  return results;
}

// src/base-loader/index.ts
var base_loader_exports = {};
__export(base_loader_exports, {
  buildDefaultAttachmentContentLoader: () => buildDefaultAttachmentContentLoader,
  createBaseLoader: () => createBaseLoader,
  defaultGetterRegistry: () => defaultGetterRegistry
});

// src/base-loader/builtins.ts
function buildDefaultAttachmentContentLoader(options) {
  return buildAttachmentLoader(options.fetchMethod);
}

// src/base-loader/createBaseLoader.ts
function resolveTable(base2, tableRef) {
  if (typeof tableRef !== "string") {
    return tableRef;
  }
  const byName = base2.tables.find(
    (table) => table.name.toLowerCase() === tableRef.toLowerCase()
  );
  if (byName) {
    return byName;
  }
  throw new Error(`Could not resolve Airtable table: ${tableRef}`);
}
function createBaseLoader(base2, options = {}) {
  const fetchMethod = options?.fetchMethod ?? fetch;
  const attachmentContentLoader = options?.attachmentContentLoader ?? buildDefaultAttachmentContentLoader({ fetchMethod });
  const registry = options.registry ?? defaultGetterRegistry({ attachmentContentLoader });
  return {
    base: base2,
    registry,
    attachmentContentLoader,
    table(tableRef) {
      const table = resolveTable(base2, tableRef);
      return {
        table,
        async select(query = {}) {
          return await selectTableRecords({
            base: base2,
            table,
            query,
            registry,
            defaultGetterModes: options.getterModes
          });
        },
        async get(recordId, query = {}) {
          const result = await selectTableRecords({
            base: base2,
            table,
            query: { ...query, recordIds: [recordId] },
            registry,
            defaultGetterModes: options.getterModes
          });
          return result.records[0] ?? null;
        },
        async first(query = {}) {
          const result = await selectTableRecords({
            base: base2,
            table,
            query,
            registry,
            defaultGetterModes: options.getterModes
          });
          return result.records[0] ?? null;
        }
      };
    },
    async tables(queries) {
      const entries = Object.entries(queries);
      const result = {};
      for (const [tableName, query] of entries) {
        result[tableName] = await this.table(tableName).select(query);
      }
      return result;
    }
  };
}

// src/template-engine/index.ts
var template_engine_exports = {};
__export(template_engine_exports, {
  parseTemplateLiteralVariableNames: () => void 0,
  parseTemplateOutline: () => parseTemplateOutline
});

// src/template-engine/parseTemplateOutline.ts
function parseTemplateOutline(outlineText, { rng = Math.random } = {}) {
  const root = parseOutline(outlineText);
  const templateStrings = expandOutline(root);
  const compiled = templateStrings.map((source) => {
    const ast = parseTemplate(source);
    return {
      source,
      ast,
      variance: countVariance(ast),
      args: collectArgs(ast)
    };
  });
  const args = {};
  for (const t of compiled) for (const k of Object.keys(t.args)) args[k] = null;
  const variance = compiled.reduce((sum, t) => sum + t.variance, 0);
  function pickWeighted() {
    let roll = rng() * variance;
    for (const t of compiled) {
      roll -= t.variance;
      if (roll <= 0) return t;
    }
    return compiled[compiled.length - 1];
  }
  function write(argValues = {}) {
    const chosen = pickWeighted();
    const ctx = { rng, args: argValues, binds: /* @__PURE__ */ Object.create(null) };
    return normalizeWhitespace(render(chosen.ast, ctx));
  }
  function writeAll(argValues = {}) {
    const all = [];
    for (const t of compiled) all.push(...expandAll(t.ast, { args: argValues }));
    const set = new Set(all.map(normalizeWhitespace).filter(Boolean));
    return Array.from(set);
  }
  function varianceUnique(argValues = {}) {
    return writeAll(argValues).length;
  }
  return { args, variance, varianceUnique, write, writeAll };
}
function parseOutline(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.replace(/\t/g, "  ")).filter((l) => l.trim().length);
  const hasBullets = lines.some((l) => /^\s*-\s+/.test(l));
  if (!hasBullets) {
    return {
      text: "",
      level: -1,
      children: [
        { text: "__GROUP__", level: 0, children: lines.map((t) => ({ text: t.trim(), level: 1, children: [] })) }
      ]
    };
  }
  const root = { text: "", level: -1, children: [] };
  const stack = [root];
  for (const raw of lines) {
    const m = raw.match(/^(\s*)-\s+(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const level = inferIndentLevel(indent);
    const node = { text: m[2].trim(), level, children: [] };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    (stack[stack.length - 1] ?? root).children.push(node);
    stack.push(node);
  }
  return root;
}
function inferIndentLevel(indentSpaces) {
  if (indentSpaces % 4 === 0) return indentSpaces / 4;
  if (indentSpaces % 2 === 0) return indentSpaces / 2;
  return Math.floor(indentSpaces / 2);
}
function expandOutline(root) {
  const out = [];
  for (const group of root.children) {
    for (const s of expandFrom(group, { emitSelf: false })) out.push(s);
  }
  return uniq(out);
}
function expandFrom(node, { emitSelf }) {
  const results = [];
  const self = stripBackticks(node.text);
  if (emitSelf) results.push(self);
  if (!node.children.length) {
    if (!emitSelf) results.push(self);
    return results;
  }
  for (const child of node.children) {
    for (const c of expandFrom(child, { emitSelf: true })) {
      results.push(joinPieces(self, stripBackticks(c)));
    }
  }
  return results;
}
function joinPieces(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (/^[,.;:!?)]/.test(b)) return a + b;
  return a + " " + b;
}
function stripBackticks(s) {
  return String(s).replace(/`/g, "");
}
function uniq(arr) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
function parseTemplate(input) {
  const s = String(input ?? "");
  const { nodes, i } = parseSeq(s, 0, null);
  if (i !== s.length) throw new Error(`Template parse: trailing content at index ${i}`);
  return normalizeSeq(nodes);
}
function parseSeq(s, start, until) {
  const nodes = [];
  let i = start;
  while (i < s.length) {
    if (until && s[i] === until) break;
    if (s[i] === "{" && s[i + 1] === "{") {
      const { node, nextI } = parseDoubleCurly(s, i);
      nodes.push(node);
      i = nextI;
      continue;
    }
    if (s[i] === "$" && s[i + 1] === "{") {
      const end2 = s.indexOf("}", i + 2);
      if (end2 === -1) throw new Error(`Unclosed \${...} at index ${i}`);
      nodes.push({ t: "arg", k: s.slice(i + 2, end2).trim() });
      i = end2 + 1;
      continue;
    }
    if (s[i] === "#") {
      const maybe = tryParseInlineBind(s, i);
      if (maybe) {
        nodes.push(...maybe.nodes);
        i = maybe.nextI;
        continue;
      }
    }
    if (s[i] === "{") {
      const { node, nextI } = parseBraceGroup(s, i);
      nodes.push(node);
      i = nextI;
      continue;
    }
    const next = nextIndexOfAny(s, i, until ? ["{", "$", "#", until] : ["{", "$", "#"]);
    const end = next === -1 ? s.length : next;
    nodes.push({ t: "text", v: s.slice(i, end) });
    i = end;
  }
  return { nodes, i };
}
function parseDoubleCurly(s, openIdx) {
  const close = findDoubleCurlyClose(s, openIdx + 2);
  if (close === -1) throw new Error(`Unclosed {{...}} at index ${openIdx}`);
  const innerRaw = s.slice(openIdx + 2, close);
  const trimmed = innerRaw.trim();
  const lookup = parseMapLookupSyntax(trimmed);
  if (lookup) {
    return { node: lookup, nextI: close + 2 };
  }
  const inner = parseTemplate(innerRaw);
  return { node: { t: "glue", inner }, nextI: close + 2 };
}
function findDoubleCurlyClose(s, fromIdx) {
  let depth = 0;
  for (let i = fromIdx; i < s.length - 1; i++) {
    if (s[i] === "{" && s[i + 1] === "{") {
      depth++;
      i++;
      continue;
    }
    if (s[i] === "}" && s[i + 1] === "}") {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
  }
  return -1;
}
function parseMapLookupSyntax(text) {
  const suffix = findLookupSuffix(text);
  if (!suffix) return null;
  const { mapText, refKey } = suffix;
  const map = parseMapPairs(mapText);
  if (!map) return null;
  return { t: "mapLookup", map, refKey };
}
function findLookupSuffix(text) {
  let depthBrace = 0;
  let depthDC = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    const prev = text[i - 1];
    if (prev === "}" && ch === "}") {
      depthDC++;
      i--;
      continue;
    }
    if (prev === "{" && ch === "{") {
      depthDC = Math.max(0, depthDC - 1);
      i--;
      continue;
    }
    if (depthDC > 0) continue;
    if (ch === "}") depthBrace++;
    else if (ch === "{") depthBrace = Math.max(0, depthBrace - 1);
    if (depthBrace > 0) continue;
    if (ch === "]") {
      const j = text.lastIndexOf("[", i);
      if (j === -1) return null;
      const inside = text.slice(j + 1, i).trim();
      const m = inside.match(/^#([A-Za-z_]\w*)$/);
      if (!m) return null;
      const mapText = text.slice(0, j).trim();
      return { mapText, refKey: m[1] };
    }
  }
  return null;
}
function parseMapPairs(mapText) {
  if (!mapText) return null;
  const parts = splitTopLevelMixed(mapText, ",");
  const map = /* @__PURE__ */ Object.create(null);
  for (const p of parts) {
    const idx = indexOfTopLevelColon(p);
    if (idx === -1) return null;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) return null;
    map[k] = parseTemplate(v);
  }
  return map;
}
function indexOfTopLevelColon(s) {
  let depthBrace = 0;
  let depthDC = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (ch === "{" && next === "{") {
      depthDC++;
      i++;
      continue;
    }
    if (ch === "}" && next === "}") {
      depthDC = Math.max(0, depthDC - 1);
      i++;
      continue;
    }
    if (depthDC > 0) continue;
    if (ch === "{") depthBrace++;
    else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
    if (depthBrace > 0) continue;
    if (ch === ":") return i;
  }
  return -1;
}
function tryParseInlineBind(s, i) {
  const m = s.slice(i).match(/^#([A-Za-z_]\w*)\s*\{/);
  if (!m) return null;
  const key = m[1];
  const braceIdx = i + m[0].lastIndexOf("{");
  const bal = extractBalanced(s, braceIdx);
  const optsRaw = bal.content;
  const opts = splitTopLevel(optsRaw, "|").map((x) => x.trim()).filter(Boolean);
  const after = bal.endIdx + 1;
  let nextI = after;
  const nodes = [{ t: "bind", key, opts }];
  if (s[nextI] && /\s/.test(s[nextI])) {
    const nextSpecial = nextIndexOfAny(s, nextI, ["{", "$", "#"]);
    const end = nextSpecial === -1 ? s.length : nextSpecial;
    const chunk = s.slice(nextI, end);
    if (/\S/.test(chunk)) {
      nodes.push({ t: "text", v: chunk });
      nextI = end;
    }
  }
  return { nodes, nextI };
}
function parseBraceGroup(s, openIdx) {
  const { content, endIdx } = extractBalanced(s, openIdx);
  let nextI = endIdx + 1;
  let isOptional = false;
  if (s[nextI] === "?") {
    isOptional = true;
    nextI++;
  }
  const innerTrim = content.trim();
  if (/^#\w+\.1$/.test(innerTrim)) {
    const m = innerTrim.match(/^#(\w+)\.1$/);
    const node2 = { t: "bindRef", key: m[1], mode: "other" };
    return { node: isOptional ? { t: "opt", inner: [node2] } : node2, nextI };
  }
  const parts = splitTopLevel(innerTrim, "|");
  if (parts.length > 1) {
    const opts = parts.map((p) => parseTemplate(p.trim()));
    const choice = { t: "choice", opts };
    return { node: isOptional ? { t: "opt", inner: [choice] } : choice, nextI };
  }
  const innerNodes = parseTemplate(innerTrim);
  const normalized = normalizeSeq(innerNodes);
  const node = normalized.length === 1 ? normalized[0] : { t: "glue", inner: normalized };
  return { node: isOptional ? { t: "opt", inner: [node] } : node, nextI };
}
function extractBalanced(s, openIdx) {
  if (s[openIdx] !== "{") throw new Error("extractBalanced: expected '{'");
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return { content: s.slice(openIdx + 1, i), endIdx: i };
    }
  }
  throw new Error(`Unclosed '{' at index ${openIdx}`);
}
function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && ch === sep) {
      out.push(s.slice(last, i));
      last = i + 1;
    }
  }
  out.push(s.slice(last));
  return out;
}
function splitTopLevelMixed(s, sepChar) {
  const out = [];
  let depthBrace = 0;
  let depthDC = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];
    if (ch === "{" && next === "{") {
      depthDC++;
      i++;
      continue;
    }
    if (ch === "}" && next === "}") {
      depthDC = Math.max(0, depthDC - 1);
      i++;
      continue;
    }
    if (depthDC > 0) continue;
    if (ch === "{") depthBrace++;
    else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
    if (depthBrace > 0) continue;
    if (ch === sepChar) {
      out.push(s.slice(last, i));
      last = i + 1;
    }
  }
  out.push(s.slice(last));
  return out;
}
function normalizeSeq(nodes) {
  const merged = [];
  for (const n of nodes) {
    const prev = merged[merged.length - 1];
    if (prev && prev.t === "text" && n.t === "text") prev.v += n.v;
    else merged.push(n);
  }
  return merged;
}
function nextIndexOfAny(s, from, chars) {
  let best = -1;
  for (const c of chars) {
    const idx = s.indexOf(c, from);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}
function collectArgs(ast) {
  const out = /* @__PURE__ */ Object.create(null);
  walkAst(ast, (n) => {
    if (n.t === "arg") out[n.k] = true;
  });
  return out;
}
function countVariance(ast) {
  const seq = (nodes) => nodes.reduce((p, n) => p * node(n), 1);
  const node = (n) => {
    switch (n.t) {
      case "text":
      case "arg":
      case "bindRef":
      case "mapLookup":
        return 1;
      case "glue":
        return seq(n.inner);
      case "bind":
        return Math.max(1, n.opts.length);
      case "opt":
        return 1 + seq(n.inner);
      case "choice":
        return n.opts.reduce((sum, opt) => sum + seq(opt), 0);
      default:
        throw new Error(`Unknown node type: ${n.t}`);
    }
  };
  return seq(ast);
}
function walkAst(ast, fn) {
  for (const n of ast) {
    fn(n);
    if (n.t === "choice") for (const opt of n.opts) walkAst(opt, fn);
    else if (n.t === "opt") walkAst(n.inner, fn);
    else if (n.t === "glue") walkAst(n.inner, fn);
    else if (n.t === "mapLookup") for (const k of Object.keys(n.map)) walkAst(n.map[k], fn);
  }
}
function render(ast, ctx) {
  const pieces = [];
  renderSeq(ast, ctx, pieces);
  return pieces.join("");
}
function renderSeq(nodes, ctx, pieces) {
  for (const n of nodes) renderNode(n, ctx, pieces);
}
function renderNode(n, ctx, pieces) {
  switch (n.t) {
    case "text":
      pieces.push(n.v);
      return;
    case "arg": {
      const value = resolveArg(n.k, ctx.args);
      pieces.push("  ", value, "  ");
      return;
    }
    case "choice": {
      const idx = Math.floor(ctx.rng() * n.opts.length);
      renderSeq(n.opts[idx], ctx, pieces);
      return;
    }
    case "opt":
      if (ctx.rng() < 0.5) return;
      renderSeq(n.inner, ctx, pieces);
      return;
    case "bind": {
      const idx = Math.floor(ctx.rng() * n.opts.length);
      ctx.binds[n.key] = { opts: n.opts, chosenIdx: idx };
      pieces.push(n.opts[idx] ?? "");
      return;
    }
    case "bindRef": {
      const b = ctx.binds[n.key];
      if (!b) return;
      const out = n.mode === "other" ? b.opts[(b.chosenIdx + 1) % b.opts.length] : b.opts[b.chosenIdx];
      pieces.push(out ?? "");
      return;
    }
    case "glue": {
      pieces.push(renderGlue(n.inner, ctx));
      return;
    }
    case "mapLookup": {
      const b = ctx.binds[n.refKey];
      if (!b) return;
      const chosen = b.opts[b.chosenIdx];
      const ast = n.map[chosen];
      if (!ast) return;
      const tmp = [];
      renderSeq(ast, ctx, tmp);
      pieces.push(tmp.join(""));
      return;
    }
    default:
      throw new Error(`Unknown node type during render: ${n.t}`);
  }
}
function renderGlue(inner, ctx) {
  const tmp = [];
  renderSeq(inner, ctx, tmp);
  return tmp.join("");
}
function expandAll(ast, { args }) {
  let states = [{ s: "", binds: /* @__PURE__ */ Object.create(null) }];
  for (const node of ast) {
    states = expandNodeAll(node, states, args);
  }
  return states.map((st) => st.s);
}
function expandNodeAll(node, states, args) {
  switch (node.t) {
    case "text":
      return states.map((st) => ({ s: st.s + node.v, binds: st.binds }));
    case "arg": {
      const val = resolveArg(node.k, args);
      const ins = "  " + val + "  ";
      return states.map((st) => ({ s: st.s + ins, binds: st.binds }));
    }
    case "opt": {
      const omitted = states.map((st) => ({ s: st.s, binds: st.binds }));
      const included = expandSeqAll(node.inner, states, args);
      return omitted.concat(included);
    }
    case "choice": {
      const out = [];
      for (const opt of node.opts) out.push(...expandSeqAll(opt, states, args));
      return out;
    }
    case "bind": {
      const out = [];
      for (let idx = 0; idx < node.opts.length; idx++) {
        const word = node.opts[idx] ?? "";
        for (const st of states) {
          const binds2 = shallowCloneBinds(st.binds);
          binds2[node.key] = { opts: node.opts, chosenIdx: idx };
          out.push({ s: st.s + word, binds: binds2 });
        }
      }
      return out;
    }
    case "bindRef": {
      return states.map((st) => {
        const b = st.binds[node.key];
        const outWord = b ? (node.mode === "other" ? b.opts[(b.chosenIdx + 1) % b.opts.length] : b.opts[b.chosenIdx]) ?? "" : "";
        return { s: st.s + outWord, binds: st.binds };
      });
    }
    case "glue": {
      const out = [];
      for (const st of states) {
        const innerStates = expandSeqAll(node.inner, [{ s: "", binds: st.binds }], args);
        for (const innerSt of innerStates) out.push({ s: st.s + innerSt.s, binds: innerSt.binds });
      }
      return out;
    }
    case "mapLookup": {
      const out = [];
      for (const st of states) {
        const b = st.binds[node.refKey];
        if (!b) {
          out.push({ s: st.s, binds: st.binds });
          continue;
        }
        const chosen = b.opts[b.chosenIdx];
        const ast2 = node.map[chosen];
        if (!ast2) {
          out.push({ s: st.s, binds: st.binds });
          continue;
        }
        const innerStates = expandSeqAll(ast2, [{ s: "", binds: st.binds }], args);
        for (const innerSt of innerStates) out.push({ s: st.s + innerSt.s, binds: innerSt.binds });
      }
      return out;
    }
    default:
      throw new Error(`Unknown node type in expandNodeAll: ${node.t}`);
  }
}
function expandSeqAll(nodes, states, args) {
  let outStates = states;
  for (const n of nodes) outStates = expandNodeAll(n, outStates, args);
  return outStates;
}
function shallowCloneBinds(binds) {
  const next = /* @__PURE__ */ Object.create(null);
  for (const k of Object.keys(binds)) next[k] = binds[k];
  return next;
}
function resolveArg(key, args) {
  if (Object.prototype.hasOwnProperty.call(args, key)) return safeToString(args[key]);
  const parts = key.split(".");
  if (!parts.length) return "";
  const rootKey = parts[0];
  if (!Object.prototype.hasOwnProperty.call(args, rootKey)) return "";
  let cur = args[rootKey];
  for (let i = 1; i < parts.length; i++) {
    if (cur == null) return "";
    cur = cur[parts[i]];
  }
  return safeToString(cur);
}
function safeToString(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  try {
    return String(v);
  } catch {
    return "";
  }
}
function normalizeWhitespace(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

// src/utils/index.ts
var utils_exports = {};
__export(utils_exports, {
  time: () => time_exports,
  toIdentifier: () => toIdentifier
});

// src/utils/time/index.ts
var time_exports = {};
__export(time_exports, {
  createTemporalContext: () => createTemporalContext,
  currentTimeContext: () => currentTimeContext,
  dateDiff: () => dateDiff,
  sortEventsByDate: () => sortEventsByDate,
  splitByDate: () => splitByDate
});

// src/utils/time/dateDiff.ts
function dateDiff(a, b, options = {}) {
  const unit = options.unit ?? "days";
  const rounding = options.rounding ?? "floor";
  const absolute = options.absolute ?? false;
  const toDate = (value) => {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${String(value)}`);
    return d;
  };
  const applyRounding = (value) => {
    switch (rounding) {
      case "ceil":
        return Math.ceil(value);
      case "round":
        return Math.round(value);
      case "exact":
        return value;
      case "floor":
      default:
        return Math.floor(value);
    }
  };
  const toUtcMidnightMs = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const da = toDate(a);
  const db = toDate(b);
  const sign = db.getTime() >= da.getTime() ? 1 : -1;
  if (unit === "days") {
    const days = (toUtcMidnightMs(db) - toUtcMidnightMs(da)) / (24 * 60 * 60 * 1e3);
    const out = Math.trunc(days);
    return absolute ? Math.abs(out) : out;
  }
  if (unit === "months" || unit === "years") {
    const start = sign === 1 ? da : db;
    const end = sign === 1 ? db : da;
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    const startDay = start.getUTCDate();
    const endDay = end.getUTCDate();
    const endBeforeStartInMonth = endDay < startDay || endDay === startDay && (end.getUTCHours() < start.getUTCHours() || end.getUTCHours() === start.getUTCHours() && (end.getUTCMinutes() < start.getUTCMinutes() || end.getUTCMinutes() === start.getUTCMinutes() && (end.getUTCSeconds() < start.getUTCSeconds() || end.getUTCSeconds() === start.getUTCSeconds() && end.getUTCMilliseconds() < start.getUTCMilliseconds())));
    if (endBeforeStartInMonth) months -= 1;
    if (rounding === "exact") {
      const msDiff = Math.abs(end.getTime() - start.getTime());
      const days = msDiff / (24 * 60 * 60 * 1e3);
      if (unit === "months") {
        const avgMonthDays = 365.2425 / 12;
        const out3 = days / avgMonthDays * sign;
        return absolute ? Math.abs(out3) : out3;
      }
      const out2 = days / 365.2425 * sign;
      return absolute ? Math.abs(out2) : out2;
    }
    const roundedMonths = applyRounding(months);
    if (unit === "months") {
      const out2 = roundedMonths * sign;
      return absolute ? Math.abs(out2) : out2;
    }
    const years = roundedMonths / 12;
    const out = applyRounding(years) * sign;
    return absolute ? Math.abs(out) : out;
  }
  throw new Error(`Unsupported unit: ${unit}`);
}

// src/utils/time/splitByDate.ts
function getByPathArray(obj, path) {
  if (obj == null) return void 0;
  let cur = obj;
  for (const key of path) {
    if (cur == null) return void 0;
    cur = cur[key];
  }
  return cur;
}
function parseDate(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function toLocalDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function splitByDate(items, datePath, referenceDate = /* @__PURE__ */ new Date(), options = {}) {
  const { mode = "day" } = options;
  const ref = parseDate(referenceDate);
  if (!ref) throw new Error("splitByDate: referenceDate is invalid.");
  const refMs = ref.getTime();
  const refDayKey = mode === "day" ? toLocalDayKey(ref) : null;
  const beforeWithMs = [];
  const onWithMs = [];
  const afterWithMs = [];
  const withoutDate = [];
  for (const item of items) {
    const raw = getByPathArray(item, datePath);
    const d = parseDate(raw);
    if (!d) {
      withoutDate.push(item);
      continue;
    }
    const ms = d.getTime();
    if (mode === "instant") {
      if (ms < refMs) beforeWithMs.push({ item, ms });
      else if (ms > refMs) afterWithMs.push({ item, ms });
      else onWithMs.push({ item, ms });
    } else {
      const dayKey = toLocalDayKey(d);
      if (dayKey < refDayKey) beforeWithMs.push({ item, ms });
      else if (dayKey > refDayKey) afterWithMs.push({ item, ms });
      else onWithMs.push({ item, ms });
    }
  }
  const asc = (a, b) => a.ms - b.ms;
  beforeWithMs.sort(asc);
  onWithMs.sort(asc);
  afterWithMs.sort(asc);
  return {
    before: beforeWithMs.map((x) => x.item),
    on: onWithMs.map((x) => x.item),
    after: afterWithMs.map((x) => x.item),
    withoutDate
  };
}

// src/utils/goToPath.ts
function goToPath(obj, path) {
  if (obj == null) return void 0;
  const keys = Array.isArray(path) ? path : typeof path === "string" ? [path] : [];
  return keys.reduce((acc, key) => {
    if (acc == null) return void 0;
    return acc[key];
  }, obj);
}

// src/utils/time/sortEventsByDate.ts
function sortEventsByDate(events, datePath, order = "asc") {
  if (!Array.isArray(events)) return [];
  const thisOrder = { asc: "asc", desc: "desc" }?.[order.toLowerCase()] ?? "asc";
  const direction = thisOrder === "desc" ? -1 : 1;
  return [...events].sort((a, b) => {
    const aValue = goToPath(a, datePath);
    const bValue = goToPath(b, datePath);
    const aTime = aValue ? (aValue instanceof Date ? aValue : new Date(aValue)).getTime() : NaN;
    const bTime = bValue ? (bValue instanceof Date ? bValue : new Date(bValue)).getTime() : NaN;
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return (aTime - bTime) * direction;
  });
}

// src/utils/time/currentTimeContext.ts
function currentTimeContext() {
  const D = /* @__PURE__ */ new Date();
  const result = {
    D,
    fullYear: D.getFullYear(),
    utcFullYear: D.getUTCFullYear(),
    month: D.getMonth(),
    utcString: D.toUTCString(),
    utcMonth: D.getUTCMonth(),
    monthName: D.toLocaleString("friendly", { month: "long" }),
    twoDigitMonth: D.toLocaleString("friendly", { month: "2-digit" }),
    twoDigitDay: D.toLocaleString("friendly", { day: "2-digit" }),
    hours: D.getHours(),
    utcHours: D.getUTCHours(),
    minutes: D.getMinutes(),
    utcMinutes: D.getUTCMinutes(),
    utcDate: D.getUTCDate(),
    json: D.toJSON(),
    dateString: D.toDateString()
  };
  const _ = result;
  return result;
}

// src/utils/time/createTemporalContext.ts
function createTemporalContext(fromDate) {
  const date = fromDate instanceof Date ? fromDate : new Date(fromDate);
  if (date.toString().toLowerCase().includes("invalid date"))
    throw new Error("Invalid date provided");
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay();
  const getDaysInMonth = (year2, month2) => new Date(year2, month2, 0).getDate();
  const getWeekNumber = (date2) => {
    const target = new Date(date2.valueOf());
    const dayNr = (date2.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + (4 - target.getDay() + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 6048e5);
  };
  const getWeekOfMonth = (date2) => {
    const firstOfMonth = new Date(date2.getFullYear(), date2.getMonth(), 1);
    const firstDayOfWeek = firstOfMonth.getDay();
    return Math.ceil((date2.getDate() + firstDayOfWeek) / 7);
  };
  const getDayOfYear = (date2) => {
    const start = new Date(date2.getFullYear(), 0, 0);
    const diff = date2 - start;
    const oneDay = 1e3 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };
  const getSeason = (month2, day, isNorthern = true) => {
    let season;
    if (month2 === 12 && day >= 21 || month2 <= 2 || month2 === 3 && day < 20) {
      season = "winter";
    } else if (month2 >= 3 && month2 <= 5) {
      if (month2 === 3 && day < 20) season = "winter";
      else if (month2 === 6 && day >= 21) season = "summer";
      else season = "spring";
    } else if (month2 >= 6 && month2 <= 8) {
      if (month2 === 6 && day < 21) season = "spring";
      else if (month2 === 9 && day >= 22) season = "autumn";
      else season = "summer";
    } else {
      if (month2 === 9 && day < 22) season = "summer";
      else if (month2 === 12 && day >= 21) season = "winter";
      else season = "autumn";
    }
    if (!isNorthern) {
      const seasonMap = {
        "spring": "autumn",
        "summer": "winter",
        "autumn": "spring",
        "winter": "summer"
      };
      season = seasonMap[season];
    }
    return season;
  };
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const centuryNumber = Math.ceil(year / 100);
  const centuryStart = (centuryNumber - 1) * 100 + 1;
  const centuryEnd = centuryNumber * 100;
  const yearInCentury = year - centuryStart + 1;
  const halfCentury = yearInCentury <= 50 ? "first" : "second";
  const quarterCentury = Math.ceil(yearInCentury / 25);
  const decadeStart = Math.floor(year / 10) * 10;
  const yearInDecade = year % 10;
  const halfDecade = yearInDecade < 5 ? "first" : "second";
  let thirdDecade;
  if (yearInDecade <= 2) thirdDecade = "early";
  else if (yearInDecade <= 6) thirdDecade = "mid";
  else thirdDecade = "late";
  const halfYear = month <= 6 ? "first" : "second";
  const quarterYear = Math.ceil(month / 3);
  let thirdYear;
  if (month <= 4) thirdYear = "early";
  else if (month <= 8) thirdYear = "mid";
  else thirdYear = "late";
  const northernHemisphere = getSeason(month, dayOfMonth, true);
  const southernHemisphere = getSeason(month, dayOfMonth, false);
  const daysInCurrentMonth = getDaysInMonth(year, month);
  const halfMonth = dayOfMonth <= 15 ? "first" : "second";
  let thirdMonth;
  if (dayOfMonth <= 9) thirdMonth = "early";
  else if (dayOfMonth <= 19) thirdMonth = "mid";
  else thirdMonth = "late";
  const weekOfYear = getWeekNumber(date);
  const weekOfMonth = getWeekOfMonth(date);
  const dayOfYear = getDayOfYear(date);
  const unixTimestamp = Math.floor(date.getTime() / 1e3);
  const isoTimestamp = date.toISOString();
  const context = {
    date: new Date(date),
    timestamp: {
      unix: unixTimestamp,
      iso: isoTimestamp
    },
    century: {
      number: centuryNumber,
      ordinal: centuryNumber === 1 ? "1st" : centuryNumber === 2 ? "2nd" : centuryNumber === 3 ? "3rd" : `${centuryNumber}th`,
      yearRange: `${centuryStart}-${centuryEnd}`,
      half: {
        number: halfCentury === "first" ? 1 : 2,
        position: halfCentury,
        yearRange: halfCentury === "first" ? `${centuryStart}-${centuryStart + 49}` : `${centuryStart + 50}-${centuryEnd}`
      },
      quarter: {
        number: quarterCentury,
        position: quarterCentury === 1 ? "first" : quarterCentury === 2 ? "second" : quarterCentury === 3 ? "third" : "fourth",
        yearRange: quarterCentury === 1 ? `${centuryStart}-${centuryStart + 24}` : quarterCentury === 2 ? `${centuryStart + 25}-${centuryStart + 49}` : quarterCentury === 3 ? `${centuryStart + 50}-${centuryStart + 74}` : `${centuryStart + 75}-${centuryEnd}`
      }
    },
    decade: {
      label: `${decadeStart}s`,
      yearRange: `${decadeStart}-${decadeStart + 9}`,
      half: {
        number: halfDecade === "first" ? 1 : 2,
        position: halfDecade,
        yearRange: halfDecade === "first" ? `${decadeStart}-${decadeStart + 4}` : `${decadeStart + 5}-${decadeStart + 9}`
      },
      third: {
        number: thirdDecade === "early" ? 1 : thirdDecade === "mid" ? 2 : 3,
        position: thirdDecade,
        yearRange: thirdDecade === "early" ? `${decadeStart}-${decadeStart + 2}` : thirdDecade === "mid" ? `${decadeStart + 3}-${decadeStart + 6}` : `${decadeStart + 7}-${decadeStart + 9}`
      }
    },
    year: {
      number: year,
      half: {
        number: halfYear === "first" ? 1 : 2,
        position: halfYear,
        months: halfYear === "first" ? "Jan-Jun" : "Jul-Dec"
      },
      quarter: {
        number: quarterYear,
        label: `Q${quarterYear}`,
        months: quarterYear === 1 ? "Jan-Mar" : quarterYear === 2 ? "Apr-Jun" : quarterYear === 3 ? "Jul-Sep" : "Oct-Dec"
      },
      third: {
        number: thirdYear === "early" ? 1 : thirdYear === "mid" ? 2 : 3,
        position: thirdYear,
        months: thirdYear === "early" ? "Jan-Apr" : thirdYear === "mid" ? "May-Aug" : "Sep-Dec"
      }
    },
    season: {
      northernHemisphere,
      southernHemisphere
    },
    month: {
      number: month,
      name: monthNames[month - 1],
      daysInMonth: daysInCurrentMonth,
      half: {
        number: halfMonth === "first" ? 1 : 2,
        position: halfMonth,
        dayRange: halfMonth === "first" ? "1-15" : `16-${daysInCurrentMonth}`
      },
      third: {
        number: thirdMonth === "early" ? 1 : thirdMonth === "mid" ? 2 : 3,
        position: thirdMonth,
        dayRange: thirdMonth === "early" ? "1-9" : thirdMonth === "mid" ? "10-19" : `20-${daysInCurrentMonth}`
      }
    },
    week: {
      ofYear: weekOfYear,
      ofMonth: weekOfMonth,
      label: `Week ${weekOfYear}`
    },
    day: {
      ofWeek: {
        number: dayOfWeek,
        name: dayNames[dayOfWeek]
      },
      ofMonth: dayOfMonth,
      ofYear: dayOfYear
    }
  };
  return context;
}

// src/utils/toIdentifier.ts
function toIdentifier(name) {
  let result = "";
  let capitalizeNext = false;
  for (const char of name) {
    const isValidStart = result.length === 0 ? /[a-zA-Z_$]/.test(char) : /[a-zA-Z0-9_$]/.test(char);
    if (/[a-zA-Z0-9_$]/.test(char)) {
      result += capitalizeNext ? char.toUpperCase() : char;
      capitalizeNext = false;
    } else {
      capitalizeNext = result.length > 0;
    }
  }
  if (/^[0-9]/.test(result)) {
    result = `_${result}`;
  }
  return result;
}
export {
  airtable_types_exports as airtableTypes,
  attachment_loader_exports as attachmentLoader,
  base_loader_exports as baseLoader,
  cell_reader_exports as cellReader,
  parser_exports as parser,
  record_loader_exports as recordLoader,
  template_engine_exports as templateEngine,
  utils_exports as utils
};
