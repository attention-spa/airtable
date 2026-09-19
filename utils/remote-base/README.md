# remote-base

Dependency-free Airtable Web API client for environments with standard `fetch`, `URLSearchParams`, `Proxy`, and ESNext support.

`remote-base` is authored as native TypeScript ESM. Alternate bundle formats are build artifacts, not part of the source module layout.

## ESM

```ts
import remoteBase from './index.ts';

remoteBase.auth = AIRTABLE_TOKEN;

const pending = remoteBase('appXXXXXXXXXXXXXX');
const base = await pending.link;
```

Auth can also be supplied on the first call:

```ts
const base = await remoteBase(
    'appXXXXXXXXXXXXXX',
    { auth: AIRTABLE_TOKEN },
).link;
```

Auth-only calls configure the shared client and return the callable:

```ts
const rb = remoteBase(AIRTABLE_TOKEN);
const base = await rb('appXXXXXXXXXXXXXX');
```

## Bulk initialization

`remoteBase.init()` can discover or preload multiple bases for one PAT:

```ts
await remoteBase.init({
    auth: AIRTABLE_TOKEN,
    bases: 'all',
});
```

The `bases` selector defaults to `'all'`:

- `'all'` and `'*'` list every base accessible to the PAT without fetching table schemas.
- `'all*'` and `'**'` list every accessible base and load each base's table schema.
- A bare base ID such as `'appXXXXXXXXXXXXXX'` fetches base metadata only.
- A suffixed base ID such as `'appXXXXXXXXXXXXXX*'` loads that base and its table schema.
- Object selectors default to `schema: true` and allow record preloading.

```ts
const bases = await remoteBase.init({
    auth: AIRTABLE_TOKEN,
    bases: [
        'appMetadataOnly00',
        'appWithSchema0000*',
        {
            id: 'appSelected000000',
            schema: true,
            records: [
                'recFirst00000000',
                'recSecond0000000',
            ],
        },
        {
            id: 'appEverything00000',
            allRecords: true,
        },
    ],
});
```

`fullData: true` and `allRecords: true` are aliases. Either loads the base schema and then calls `fetchFullData()`. Supplying `records` loads the schema and fetches only those record IDs, searching the base's tables until each record is found.

Record loading necessarily requires table schema. Therefore `schema: false` is ignored when `fullData`, `allRecords`, or a non-empty `records` list is supplied:

```ts
await remoteBase.init({
    auth: AIRTABLE_TOKEN,
    bases: [{
        id: 'app8N0WokOcmuuyDi',
        allRecords: true,
        schema: false, // effectively true because records require schema
    }],
});
```

Duplicate base selectors are merged. The strongest request wins: schema loading is preserved, `fullData`/`allRecords` wins over partial record loading, and requested record IDs are de-duplicated.

## Lazy data

```ts
const records = await remoteBase('appXXXXXXXXXXXXXX').Tasks.records;
const data = await remoteBase('appXXXXXXXXXXXXXX').data;
```

Default reads fetch Airtable's normal JSON cell values. Record cell data is stored under `record.field`, keyed by normalized field ID:

```ts
const [record] = await remoteBase('appXXXXXXXXXXXXXX').Tasks.records;

record.field.values.fldxxxxxxxxxxxxxx;
record.field.strings; // {} until explicitly loaded
```

`record.fields` does not store a second copy of the cell data. It is a case-insensitive proxy over `record.field.values` that accepts either a field name or field ID:

```ts
record.fields.Status;
record.fields.status;
record.fields['fldXXXXXXXXXXXXXX'];
```

All three resolve through the table schema to the same normalized field ID and return the corresponding value from `record.field.values`.

String-formatted Airtable reads are explicit because they require a separate Web API request:

```ts
const table = await remoteBase('appXXXXXXXXXXXXXX').Tasks;

await table.fetchFullRecords({ format: 'strings' });
record.field.strings.fldxxxxxxxxxxxxxx;

await table.fetchFullRecords({ format: 'both' });
```

`format: 'both'` loads normal values first and string-formatted values second. `record.fields` always proxies `record.field.values`, never `record.field.strings`.

### Full-base reads

`fetchFullData()` additionally supports graph-style record-link resolution and hidden parent metadata:

```ts
const base = await remoteBase('appXXXXXXXXXXXXXX').link;

await base.fetchFullData({
    followRecordLinks: true,
    hiddenMetadataKey: 'meta',
});
```

The defaults are equivalent to:

```ts
await base.fetchFullData({
    followRecordLinks: true,
    hiddenMetadataKey: 'meta',
});
```

`followRecordLinks: true` resolves linked-record cell arrays lazily. The raw Airtable record IDs remain stored once internally; the public cell property becomes a getter whose array entries are lightweight, finite references:

```ts
const task = base.Tasks.record('recXXXXXXXXXXXXXX');
const assignee = task.fields.Assignees[0];

assignee.id;     // 'recYYYYYYYYYYYYYY'
assignee.record; // exact cached record from the linked table

assignee.record ===
    base.People.record(assignee.id);
```

Each linked reference exposes only `id` as an enumerable property. Its `record` property is a non-enumerable getter, so logging or serializing a fully walked base does not recursively expand the linked-record graph:

```ts
JSON.stringify(task.fields.Assignees);
// [{"id":"recYYYYYYYYYYYYYY"}]
```

No linked record objects are copied into the source record, and the reference `id` itself is getter-backed from the original raw ID array rather than stored a second time. Setting `followRecordLinks: false` exposes the original record-ID arrays again.

When `hiddenMetadataKey` is `'meta'` or `true`, supported objects receive a non-enumerable `meta` property:

```ts
record.meta.type;   // 'record'
record.meta.parent; // parent table

field.meta.type;    // 'field'
field.meta.parent;  // parent table

field.options.meta.type;   // 'fieldOptions'
field.options.meta.parent; // parent field

table.meta.type;    // 'table'
table.meta.parent;  // parent base

view.meta.type;     // 'view'
view.meta.parent;   // parent table

base.meta.type;     // 'base'
base.meta.parent;   // undefined
```

Object-valued cell values, including linked-record arrays, also receive `cellValue` metadata whose `parent` resolves to the field. Primitive JavaScript values such as strings and numbers remain primitives and therefore cannot carry hidden properties without changing their runtime type.

A custom key can be used:

```ts
await base.fetchFullData({
    hiddenMetadataKey: 'context',
});

record.context.type;
```

Use `false` or `null` to disable hidden metadata:

```ts
await base.fetchFullData({
    hiddenMetadataKey: false,
});
```

The key must be a valid JavaScript property name. Reserved record keys such as `id`, `name`, `field`, and `fields` are rejected, and any collision with an existing object property throws rather than overwriting data.

Existing read options remain available. If `format: 'strings'` is requested while `followRecordLinks` is enabled, `fetchFullData()` loads both values and strings because raw linked-record IDs are required to resolve record references.

After a base links, subsequent base lookups return the cached base synchronously. Table data behaves the same way after the requested read format has loaded.

`base.table` is the same array object as `base.tables`, decorated with non-enumerable getters and a case-insensitive `.get(ref)` lookup:

```ts
base.table === base.tables;
base.table.Tasks;
base.table.tblXXXXXXXXXXXXXX;
base.table.get('tasks');
```

The linked base also receives table ID/name getters directly.

## Mutations

Tables expose:

- `fetchFullRecords()`
- `upsertRecords()`
- `deleteRecords()`

The base exposes `update()` for mixed table mutations and `fetchFullData()` for loading all records in all tables.

Id-less upserts use Airtable `performUpsert`; the primary field is the default merge key unless `fieldsToMergeOn` is supplied.

## Optional bundles

Bundling is owned by the repository root, not this utility.

Default ESM bundle:

```sh
npm run bundle
```

This produces `dist/bundle.mjs` from `utils/index.ts`.

A remote-base-only bundle can be requested explicitly:

```sh
npm run bundle -- utils/remote-base/index.ts
```

For environments that cannot consume ESM, request another `tsup` format rather than maintaining a second source implementation:

```sh
npm run bundle -- utils/remote-base/index.ts --format iife --global-name remoteBaseModule
```

That path is intended for cases such as fetching bundle source as text and evaluating it inside an Airtable Automation script. The ESM source remains canonical.
