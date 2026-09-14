

## Args
### Target
- type: string|FieldRef
- default: `{Source}`
### ByteRangeRe2GroupName
- type?: string
- default: `unicodeCharByteSize`



## Formula

```js
REGEX_REPLACE(
  REGEX_REPLACE(
    {{Target}} & '',
    '(?<UTF8>(?<1b>[\\u{0000}-\\u{007F}])|(?<2b>[\\u{0080}-\\u{07FF}])|(?<3b>[\\u{0800}-\\u{FFFF}])|(?<4b>[\\u{10000}-\\u{10FFFF}]))',
    '{{{1{$<1b>}b||2{$<2b>}b||3{$<3b>}b||4{$<4b>}b}}}\n'
  ),
  '(?msi)^\\{{3}(?:(?:\\d\\{\\}b(?:\\|{2})?)+|(?:(?<' & {{ByteRangeRe2GroupName}} & '>\\d)\\{(?<unicodeCharacterRaw>.)\\}b(?:\\|{2})?))+\\}{3}$',
  '$<' & {{ByteRangeRe2GroupName}} & '>'
)
```
