
## Code
A 2-pass UTF-8 byte-width classifier for Unicode code points.

<details>
  <summary>Output UTF-8 byte widths: [1–4] bytes, equivalent to [8–32] encoded bits.</summary>

```js {data-lang="airtable"}
REGEX_REPLACE(
  REGEX_REPLACE(
    Source,
    '(?<scalar>(?<b1>[\\u{0000}-\\u{007F}])|(?<b2>[\\u{0080}-\\u{07FF}])|(?<b3>[\\u{0800}-\\u{D7FF}\\u{E000}-\\u{FFFF}])|(?<b4>[\\u{10000}-\\u{10FFFF}]))',
    '{{{1{$<b1>}b||2{$<b2>}b||3{$<b3>}b||4{$<b4>}b}}}\n'
  ),
  '(?ms)^\\{{3}(?:(?:\\d\\{\\}b(?:\\|{2})?)+|(?:(?<utf8ByteLength>\\d)\\{(?<matchedScalar>[\\s\\S]+?)\\}b(?:\\|{2})?))+\\}{3}$',
  '$<utf8ByteLength>'
)
```

</details>









<details>
  <summary>Output RE2-style capture groups for accurately matching UTF-8 characters without breaking any by splitting its bytes / code points.</summary>

```js {data-lang="airtable"}
REGEX_REPLACE(
  REGEX_REPLACE(
    Source,
    '(?<scalar>(?<b1>[\\u{0000}-\\u{007F}])|(?<b2>[\\u{0080}-\\u{07FF}])|(?<b3>[\\u{0800}-\\u{D7FF}\\u{E000}-\\u{FFFF}])|(?<b4>[\\u{10000}-\\u{10FFFF}]))',
    '{{{§([\\u{0000}-\\u{007F}])§{$<b1>}b||§([\\u{0080}-\\u{07FF}])§{$<b2>}b||§([\\u{0800}-\\u{D7FF}\\u{E000}-\\u{FFFF}])§{$<b3>}b||§([\\u{10000}-\\u{10FFFF}])§{$<b4>}b}}}\n'
  ),
  '(?m)^\\{{3}(?:§[^§\\r\\n]+§\\{\\}b\\|{2})*§(?<matchingRE2Group>[^§\\r\\n]+)§\\{(?<matchedScalar>[\\s\\S]+?)\\}b(?:\\|{2}§[^§\\r\\n]+§\\{\\}b)*\\}{3}$(?<nl>\\x0a)?',
  '$<matchingRE2Group>$<nl>'
)
```

</details>







## Examples

<details>
  <summary>Basic UTF-8 byte-width classification</summary>

```txt
💝⟜ćc
```

Returns:

```txt
4321
```

This reflects the UTF-8 byte length of each corresponding Unicode code point:

| Glyph | Code point | UTF-8 byte length |
| ----- | ---------: | ----------------: |
| 💝    |    U+1F49D |                 4 |
| ⟜     |     U+27DC |                 3 |
| ć     |     U+0107 |                 2 |
| c     |     U+0063 |                 1 |

</details>

## Notes

This formula classifies code points by UTF-8 byte length. It does not segment grapheme clusters. A user-perceived character may consist of multiple Unicode code points, so complex emoji, flags, combining-mark sequences, and zero-width-joiner sequences may produce multiple output digits.
