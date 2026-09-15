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

## Lazy data

```ts
const records = await remoteBase('appXXXXXXXXXXXXXX').Tasks.records;
const data = await remoteBase('appXXXXXXXXXXXXXX').data;
```

After a base links, subsequent base lookups return the cached base synchronously. Table data behaves the same way after it has loaded.

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
