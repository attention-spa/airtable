# Airtable Dynamic Number and Capture-Reference Sequences

This formula pipeline generates ordered numeric sequences without storing a prewritten list of integers. It expands the decimal alphabet through four global `REGEX_REPLACE()` passes, trims the generated candidates at `{N}`, removes leading zeroes, and optionally converts the numbers to `$1`, `$2`, `$3`, and so on.

The implementation supports `{N}` values through **50,000**. Since a single Airtable text cell cannot hold the complete `1…50000` string, the output is divided into five independently blanking chunks.

## Inputs

| Field | Type | Purpose |
| --- | --- | --- |
| `N` | Number | Inclusive upper bound, clamped by the output formulas to their supported ranges. |
| `Number Delimiter` | Long text | Optional separator. Blank means comma. Literal `\n` or `\\n` becomes a newline; literal `\t` or `\\t` becomes a tab. A real newline, real tab, or any other string is preserved. |

## Pipeline

```text
Number Delimiter
  → Resolved Number Delimiter
  → Expand 10
  → Expand 100
  → Expand 1,000
  → Padded 0–9,999
  → Cut at N
  → Unpadded
  → Sequence 1–9,999

Padded 0–9,999
  → prefixed range chunks 10,000–50,000

Each numeric output chunk
  → corresponding $capture-reference chunk
```

The `[[0000]]` wrappers are structural tokens. They let the cutoff and unpadding formulas identify numbers without treating the user-selected delimiter as regex syntax.

## Formulas

<details>
  <summary><strong>Resolved Number Delimiter</strong> — normalize comma, newline, and tab delimiters.</summary>

<!-- airtable-formula: Resolved Number Delimiter -->
```js {data-lang="airtable"}
IF(
  {Number Delimiter} = "",
  ",",
  IF(
    REGEX_MATCH({Number Delimiter}, "^\\\\{1,2}n$"),
    "\n",
    IF(
      REGEX_MATCH({Number Delimiter}, "^\\\\{1,2}t$"),
      "\t",
      {Number Delimiter}
    )
  )
)
```

Blank defaults to a comma. One or two literal backslashes followed by `n` or `t` are decoded. Everything else passes through unchanged.

</details>

<details>
  <summary><strong>Sequence · Expand 10</strong> — expand one seed into ten first-digit branches.</summary>

<!-- airtable-formula: Sequence · Expand 10 -->
```js {data-lang="airtable"}
REGEX_REPLACE(
  "{4:}",
  "\\{4:(?<p>[^}]*)\\}",
  "{3:$<p>" &
  SUBSTITUTE(
    "0|1|2|3|4|5|6|7|8|9",
    "|",
    "}" & {Resolved Number Delimiter} & "{3:$<p>"
  ) &
  "}"
)
```

The seed `{4:}` records four unresolved decimal positions. The replacement emits branches ending in `0–9` and decrements the depth marker.

</details>

<details>
  <summary><strong>Sequence · Expand 100</strong> — expand ten branches into one hundred.</summary>

<!-- airtable-formula: Sequence · Expand 100 -->
```js {data-lang="airtable"}
REGEX_REPLACE(
  {Sequence · Expand 10},
  "\\{3:(?<p>[^}]*)\\}",
  "{2:$<p>" &
  SUBSTITUTE(
    "0|1|2|3|4|5|6|7|8|9",
    "|",
    "}" & {Resolved Number Delimiter} & "{2:$<p>"
  ) &
  "}"
)
```

Every `{3:prefix}` token becomes ten `{2:prefix+digit}` tokens.

</details>

<details>
  <summary><strong>Sequence · Expand 1,000</strong> — expand one hundred branches into one thousand.</summary>

<!-- airtable-formula: Sequence · Expand 1,000 -->
```js {data-lang="airtable"}
REGEX_REPLACE(
  {Sequence · Expand 100},
  "\\{2:(?<p>[^}]*)\\}",
  "{1:$<p>" &
  SUBSTITUTE(
    "0|1|2|3|4|5|6|7|8|9",
    "|",
    "}" & {Resolved Number Delimiter} & "{1:$<p>"
  ) &
  "}"
)
```

Every `{2:prefix}` token becomes ten `{1:prefix+digit}` tokens.

</details>

<details>
  <summary><strong>Sequence · Padded 0–9999</strong> — resolve the final digit and wrap every candidate.</summary>

<!-- airtable-formula: Sequence · Padded 0–9999 -->
```js {data-lang="airtable"}
REGEX_REPLACE(
  {Sequence · Expand 1,000},
  "\\{1:(?<p>[^}]*)\\}",
  "[[$<p>" &
  SUBSTITUTE(
    "0|1|2|3|4|5|6|7|8|9",
    "|",
    "]]" & {Resolved Number Delimiter} & "[[$<p>"
  ) &
  "]]"
)
```

This produces `[[0000]]` through `[[9999]]`. The wrappers make later operations independent of the chosen delimiter.

</details>

<details>
  <summary><strong>Sequence · Cut at N</strong> — retain wrapped values from 0001 through MIN(N, 9999).</summary>

<!-- airtable-formula: Sequence · Cut at N -->
```js {data-lang="airtable"}
IF(
  INT({N}) >= 1,
  REGEX_REPLACE(
    {Sequence · Padded 0–9999},
    "^[\\s\\S]*?(?<keep>\\[\\[0001\\]\\][\\s\\S]*?\\[\\[" &
    RIGHT(
      "0000" & MIN(9999, INT({N})),
      4
    ) &
    "\\]\\])(?:[\\s\\S]*)$",
    "$<keep>"
  ),
  ""
)
```

The lazy capture starts at `[[0001]]` and ends at the padded target. `N < 1` returns blank.

</details>

<details>
  <summary><strong>Sequence · Unpadded</strong> — remove wrappers and leading zeroes.</summary>

<!-- airtable-formula: Sequence · Unpadded -->
```js {data-lang="airtable"}
IF(
  {Sequence · Cut at N},
  REGEX_REPLACE(
    {Sequence · Cut at N},
    "\\[\\[(?:000([1-9])|00([1-9][0-9])|0([1-9][0-9]{2})|([1-9][0-9]{3}))\\]\\]",
    "$1$2$3$4"
  ),
  ""
)
```

Exactly one alternative captures each nonzero integer width, so concatenating `$1$2$3$4` returns the unpadded value.

</details>

<details>
  <summary><strong>Sequence 1–9,999</strong> — public first numeric output chunk.</summary>

<!-- airtable-formula: Sequence 1–9,999 -->
```js {data-lang="airtable"}
{Sequence · Unpadded}
```

</details>

<details>
  <summary><strong>Sequence 10,000–19,999</strong> — prefix the reusable suffix sequence with 1.</summary>

<!-- airtable-formula: Sequence 10,000–19,999 -->
```js {data-lang="airtable"}
IF(
  INT({N}) >= 10000,
  REGEX_REPLACE(
    REGEX_REPLACE(
      {Sequence · Padded 0–9999},
      "^(?<keep>\\[\\[0000\\]\\][\\s\\S]*?\\[\\[" &
      RIGHT(
        "0000" & MIN(9999, INT({N}) - 10000),
        4
      ) &
      "\\]\\])(?:[\\s\\S]*)$",
      "$<keep>"
    ),
    "\\[\\[(?<suffix>[0-9]{4})\\]\\]",
    "1$<suffix>"
  ),
  ""
)
```

</details>

<details>
  <summary><strong>Sequence 20,000–29,999</strong> — prefix the reusable suffix sequence with 2.</summary>

<!-- airtable-formula: Sequence 20,000–29,999 -->
```js {data-lang="airtable"}
IF(
  INT({N}) >= 20000,
  REGEX_REPLACE(
    REGEX_REPLACE(
      {Sequence · Padded 0–9999},
      "^(?<keep>\\[\\[0000\\]\\][\\s\\S]*?\\[\\[" &
      RIGHT(
        "0000" & MIN(9999, INT({N}) - 20000),
        4
      ) &
      "\\]\\])(?:[\\s\\S]*)$",
      "$<keep>"
    ),
    "\\[\\[(?<suffix>[0-9]{4})\\]\\]",
    "2$<suffix>"
  ),
  ""
)
```

</details>

<details>
  <summary><strong>Sequence 30,000–39,999</strong> — prefix the reusable suffix sequence with 3.</summary>

<!-- airtable-formula: Sequence 30,000–39,999 -->
```js {data-lang="airtable"}
IF(
  INT({N}) >= 30000,
  REGEX_REPLACE(
    REGEX_REPLACE(
      {Sequence · Padded 0–9999},
      "^(?<keep>\\[\\[0000\\]\\][\\s\\S]*?\\[\\[" &
      RIGHT(
        "0000" & MIN(9999, INT({N}) - 30000),
        4
      ) &
      "\\]\\])(?:[\\s\\S]*)$",
      "$<keep>"
    ),
    "\\[\\[(?<suffix>[0-9]{4})\\]\\]",
    "3$<suffix>"
  ),
  ""
)
```

</details>

<details>
  <summary><strong>Sequence 40,000–50,000</strong> — prefix with 4 and append the terminal 50,000 value.</summary>

<!-- airtable-formula: Sequence 40,000–50,000 -->
```js {data-lang="airtable"}
IF(
  INT({N}) >= 40000,
  REGEX_REPLACE(
    REGEX_REPLACE(
      {Sequence · Padded 0–9999},
      "^(?<keep>\\[\\[0000\\]\\][\\s\\S]*?\\[\\[" &
      RIGHT(
        "0000" & MIN(9999, INT({N}) - 40000),
        4
      ) &
      "\\]\\])(?:[\\s\\S]*)$",
      "$<keep>"
    ),
    "\\[\\[(?<suffix>[0-9]{4})\\]\\]",
    "4$<suffix>"
  ) &
  IF(
    INT({N}) >= 50000,
    {Resolved Number Delimiter} & "50000",
    ""
  ),
  ""
)
```

</details>

## Capture-reference outputs

Each capture-reference formula reuses a numeric chunk, prepends the first `$`, and replaces every delimiter with `delimiter + "$"`. Empty numeric chunks remain empty.

<details>
  <summary><strong>Capture References 1–9,999</strong></summary>

<!-- airtable-formula: Capture References 1–9,999 -->
```js {data-lang="airtable"}
IF(
  {Sequence 1–9,999},
  "$" & SUBSTITUTE(
    {Sequence 1–9,999},
    {Resolved Number Delimiter},
    {Resolved Number Delimiter} & "$"
  ),
  ""
)
```

</details>

<details>
  <summary><strong>Capture References 10,000–19,999</strong></summary>

<!-- airtable-formula: Capture References 10,000–19,999 -->
```js {data-lang="airtable"}
IF(
  {Sequence 10,000–19,999},
  "$" & SUBSTITUTE(
    {Sequence 10,000–19,999},
    {Resolved Number Delimiter},
    {Resolved Number Delimiter} & "$"
  ),
  ""
)
```

</details>

<details>
  <summary><strong>Capture References 20,000–29,999</strong></summary>

<!-- airtable-formula: Capture References 20,000–29,999 -->
```js {data-lang="airtable"}
IF(
  {Sequence 20,000–29,999},
  "$" & SUBSTITUTE(
    {Sequence 20,000–29,999},
    {Resolved Number Delimiter},
    {Resolved Number Delimiter} & "$"
  ),
  ""
)
```

</details>

<details>
  <summary><strong>Capture References 30,000–39,999</strong></summary>

<!-- airtable-formula: Capture References 30,000–39,999 -->
```js {data-lang="airtable"}
IF(
  {Sequence 30,000–39,999},
  "$" & SUBSTITUTE(
    {Sequence 30,000–39,999},
    {Resolved Number Delimiter},
    {Resolved Number Delimiter} & "$"
  ),
  ""
)
```

</details>

<details>
  <summary><strong>Capture References 40,000–50,000</strong></summary>

<!-- airtable-formula: Capture References 40,000–50,000 -->
```js {data-lang="airtable"}
IF(
  {Sequence 40,000–50,000},
  "$" & SUBSTITUTE(
    {Sequence 40,000–50,000},
    {Resolved Number Delimiter},
    {Resolved Number Delimiter} & "$"
  ),
  ""
)
```

</details>

## Behavior and limits

<details>
  <summary>Why the output is split into five fields</summary>

The string `1,2,3,…,50000` is roughly 289,000 characters before longer custom delimiters are considered. Airtable text values are limited to approximately 100,000 characters, so no single formula cell can safely contain the full result. Each 10,000-value chunk stays below that ceiling with short delimiters.

A long custom delimiter can still push an individual chunk past the cell limit. The generator does not truncate by character count; it truncates by numeric range.

</details>

<details>
  <summary>Why the delimiter is inserted from the first expansion pass</summary>

The selected delimiter is part of every intermediate expansion, so newline and tab output are native throughout the pipeline. The cutoff formulas do not need to parse the delimiter because wrapped number tokens provide stable boundaries.

</details>

<details>
  <summary>Why this is algorithmic rather than a prewritten sequence</summary>

The formulas hardcode only the finite decimal alphabet `0–9`. Four global rewrite passes form the Cartesian product of those digits, generating `0000–9999`. Higher ranges reuse the same suffix space and add a leading digit.

</details>

## Self-parsing singleton compiler

Save this Markdown file as `airtable-dynamic-number-sequence.md`. The function below reads that document, extracts blocks marked with `<!-- airtable-formula: … -->`, follows formula-field dependencies, and recursively inlines them into one standalone Airtable formula.

The external input fields `{N}` and `{Number Delimiter}` remain field references because they do not have marked formula definitions. Pass any documented formula name as `target`; the default compiles `Sequence 1–9,999`.

```mjs
export default async function compileAirtableFormulaFromMarkdown(
  source = new URL("./airtable-dynamic-number-sequence.md", import.meta.url),
  target = "Sequence 1–9,999"
) {
  const markdown =
    typeof source === "string" && /\n|<!--\s*airtable-formula:/i.test(source)
      ? source
      : await (async () => {
          const url = source instanceof URL ? source : new URL(source, import.meta.url);
          if (url.protocol === "file:") {
            const { readFile } = await import("node:fs/promises");
            return readFile(url, "utf8");
          }
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Unable to read Markdown: ${response.status} ${response.statusText}`);
          }
          return response.text();
        })();

  const formulas = new Map();
  const blockPattern =
    /<!--\s*airtable-formula:\s*([^\r\n]+?)\s*-->\s*```(?:js|airtable)?[^\r\n]*\r?\n([\s\S]*?)\r?\n```/g;

  for (const match of markdown.matchAll(blockPattern)) {
    const name = match[1].trim();
    const formula = match[2].trim();
    if (formulas.has(name)) throw new Error(`Duplicate formula block: ${name}`);
    formulas.set(name, formula);
  }

  if (!formulas.has(target)) {
    throw new Error(
      `Unknown formula target ${JSON.stringify(target)}. Available: ${[...formulas.keys()].join(", ")}`
    );
  }

  const cache = new Map();
  const active = new Set();
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const compile = (name) => {
    if (cache.has(name)) return cache.get(name);
    if (active.has(name)) throw new Error(`Circular formula dependency involving ${name}`);

    active.add(name);
    let formula = formulas.get(name);

    for (const dependency of formulas.keys()) {
      if (dependency === name || !formula.includes(`{${dependency}}`)) continue;
      const fieldReference = new RegExp(`\\{${escapeRegExp(dependency)}\\}`, "g");
      formula = formula.replace(fieldReference, `(${compile(dependency)})`);
    }

    active.delete(name);
    cache.set(name, formula);
    return formula;
  };

  return compile(target);
}
```
