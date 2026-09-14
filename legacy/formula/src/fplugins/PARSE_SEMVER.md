
```js
REGEX_REPLACE(
  REGEX_REPLACE(
    "-parentDelimiter @ -childDelimiter . -stringDelim ` -arrayDelims []"
    & "@semver.nullError:`#ERROR: Version not defined.`"
    & "@semver.invalidError:`#ERROR: Invalid SemVer string.`"
    & "@semver.nullSymbol:false"
    & "@semver.print:[major, minor, patch, prerelease?, buildmetadata?]"
    & "@semver"
    & {version.semver} & " ",
    "(?i)^\\s*-parentdelim(?:iter)?s?\\s*@\\s*-childdelim(?:iter)?s?\\s*\\.\\s*-stringdelim(?:iter)?s?\\s*`\\s*-arraydelim(?:iter)?s?\\s*\\[\\]\\s*@semver\\.nullError:\\s*(?:false|(?P<nullErrorOn>`)(?P<nullError>[^`]*)`)\\s*@semver\\.invalidError:\\s*(?:false|(?P<invalidErrorOn>`)(?P<invalidError>[^`]*)`)\\s*@semver\\.nullSymbol:\\s*(?:false|(?P<nullSymbolOn>`)(?P<nullSymbol>[^`]*)`)\\s*@semver\\.print:\\s*\\[\\s*(?P<printMajor>major)(?P<majorOpt>\\?)?\\s*,\\s*(?P<printMinor>minor)(?P<minorOpt>\\?)?\\s*,\\s*(?P<printPatch>patch)(?P<patchOpt>\\?)?(?:\\s*,\\s*(?P<printPrerelease>prerelease)(?P<prereleaseOpt>\\?)?)?(?:\\s*,\\s*(?P<printBuildmetadata>buildmetadata)(?P<buildmetadataOpt>\\?)?)?\\s*\\]\\s*@semver\\s*(?:(?P<missing>\\x20)|(?P<valid>(?P<major>0|[1-9]\\d*)\\.(?P<minor>0|[1-9]\\d*)\\.(?P<patch>0|[1-9]\\d*)(?:-(?P<prerelease>(?:0|[1-9]\\d*|\\d*[A-Z-][0-9A-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[A-Z-][0-9A-Z-]*))*))?(?:\\+(?P<buildmetadata>[0-9A-Z-]+(?:\\.[0-9A-Z-]+)*))?)\\x20|(?P<invalid>.*)\\x20)$",
    "§$<missing>¤$<nullErrorOn>␝$<nullError>§§$<valid>¤$<printMajor>$<majorOpt>␜major: $<major>␟$<nullSymbolOn>␞$<nullSymbol>\n$<printMinor>$<minorOpt>␜minor: $<minor>␟$<nullSymbolOn>␞$<nullSymbol>\n$<printPatch>$<patchOpt>␜patch: $<patch>␟$<nullSymbolOn>␞$<nullSymbol>\n$<printPrerelease>$<prereleaseOpt>␜prerelease: $<prerelease>␟$<nullSymbolOn>␞$<nullSymbol>\n$<printBuildmetadata>$<buildmetadataOpt>␜buildmetadata: $<buildmetadata>␟$<nullSymbolOn>␞$<nullSymbol>§§$<invalid>¤$<invalidErrorOn>␝$<invalidError>§"
  ),
  "§¤[^§]*§|§[^¤§]+¤|§|`␝|␝[^§\n]*|\n?␜[^\n§]*|\n?[^␜\n§]*\\?␜[^:\n§]+: ␟␞[^§\n]*|[^␜\n§]+\\??␜|(?<prefix>: )(?:(?<notNull>[^␟§\n]+)␟(?:`?␞[^§\n]*)|␟`␞(?<isNull>[^§\n]*))",
  "$<prefix>$<notNull>$<isNull>"
)
```
