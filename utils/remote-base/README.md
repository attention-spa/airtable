# remote-base

Dependency-free Airtable Web API client with lazy base/table linking and local record caching.

## ESM

```js
import remoteBase from './utils/remote-base/index.js';

remoteBase.auth = AIRTABLE_PAT;

const base = await remoteBase('appXXXXXXXXXXXXXX').link;
const records = await remoteBase('appXXXXXXXXXXXXXX').Tasks.records;
```

The first successful link caches the concrete base object. Later calls for that base return the cached object synchronously:

```js
const base = remoteBase('appXXXXXXXXXXXXXX');
```

Base IDs and table IDs can also be extracted from Airtable URL-like strings. Table lookup via `.get(ref)` is case-insensitive.

```js
const table = remoteBase(
    'https://airtable.com/appXXXXXXXXXXXXXX/tblYYYYYYYYYYYYYY',
);

const records = await table.records;
```

`base.table` is the same array object as `base.tables`, decorated with lookup getters and `.get(ref)`:

```js
base.table === base.tables;
base.table.Tasks;
base.table.tasks;
base.table.tblYYYYYYYYYYYYYY;
base.table.get('Tasks');
```

Linked bases also expose table getters directly:

```js
base.Tasks;
base.tasks;
```

Authentication may be configured once by property assignment, config, or an initial call:

```js
remoteBase.auth = AIRTABLE_PAT;
remoteBase.config = { auth: AIRTABLE_PAT };
remoteBase.config({ app: BASE_ID, auth: AIRTABLE_PAT });
remoteBase(AIRTABLE_PAT)(BASE_ID);
remoteBase(BASE_ID, { auth: AIRTABLE_PAT });
```

Use `.data` or `fetchFullData()` to hydrate all table records:

```js
await remoteBase(BASE_ID).data;
```

## Standalone IIFE

`iife.js` is generated from `factory.js` and has no imports or exports. Evaluating it returns an isolated `remoteBase` callable, which is useful in Airtable Automation scripts where dynamic awaited imports are unavailable:

```js
const source = await fetch(RAW_IIFE_URL).then(response => response.text());
const remoteBase = eval(source);

remoteBase.auth = AIRTABLE_PAT;

const base = await remoteBase(BASE_ID).data;
```

Regenerate the standalone file after changing `factory.js`:

```sh
node utils/remote-base/build-iife.mjs
```
