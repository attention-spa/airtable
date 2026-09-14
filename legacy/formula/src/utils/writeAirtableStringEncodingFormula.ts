export function writeAirtableStringEncodingFormula ({
  
    outputFormat = "hex",

    // Default requested shape.
    // Accepts "{FieldToConvert}" or "FieldToConvert".
    fieldName = "{FieldToConvert}",

    // Optional raw Airtable expression override.
    // Example: source = "{My Field} & ''"
    source = null,

    // Default:
    // - hex/binary: " "
    // - base64: ""
    delimiter = undefined,

    minify = false,

    // Trims the final delimiter for hex/binary and optional delimited Base64.
    trimTrailingDelimiter = true,

    // Internal token syntax. Usually leave these alone.
    tokenStart = "{",
    tokenEnd = "}",
    candidateDelimiter = "|",
    markerOpen = "\uE000",
    markerClose = "\uE001",
} = {})
{
    const normalizedFormat = String(outputFormat).toLowerCase();

    const format =
        normalizedFormat === "hex" || normalizedFormat === "hexadecimal"
            ? "hex"
            : normalizedFormat === "bin" || normalizedFormat === "binary"
                ? "binary"
                : normalizedFormat === "base64" || normalizedFormat === "b64"
                    ? "base64"
                    : null;

    if (!format) {
        throw new Error(
            `Invalid outputFormat: ${outputFormat}. Expected hex, hexadecimal, bin, binary, base64, or b64.`,
        );
    }

    const outputDelimiter =
        delimiter === undefined ? (format === "base64" ? "" : " ") : String(delimiter);

    for (const forbidden of [
        tokenStart,
        tokenEnd,
        candidateDelimiter,
        markerOpen,
        markerClose,
    ]) {
        if (forbidden && outputDelimiter.includes(forbidden)) {
            throw new Error(
                `The output delimiter must not contain internal token syntax: ${JSON.stringify(forbidden)}`,
            );
        }
    }

    const BASE64 =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    const fieldExpr =
        source ??
        (() =>
        {
            const raw = String(fieldName).trim();
            return /^\{[^}]+\}$/.test(raw) ? `${raw} & ""` : `{${raw}} & ""`;
        })();

    // This is the critical part:
    // mimics encodeURIComponent(...) before tokenization.
    //
    // For example:
    // 😂 -> %F0%9F%98%82
    const encodedExpr = `ENCODE_URL_COMPONENT(${fieldExpr})`;

    const indent = (value, spaces = 2) =>
        String(value)
            .split("\n")
            .map((line) => " ".repeat(spaces) + line)
            .join("\n");

    const q = (value) =>
        `"${String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")}"`;

    const call = (name, args) =>
    {
        if (minify) return `${name}(${args.join(",")})`;

        return `${name}(\n${args.map((arg) => indent(arg, 2)).join(",\n")}\n)`;
    };

    const wrap = (expr) =>
    {
        if (minify) return `(${expr})`;
        return `(\n${indent(expr, 2)}\n)`;
    };

    const regexReplace = (input, pattern, replacement) =>
        call("REGEX_REPLACE", [input, q(pattern), q(replacement)]);

    const len = (input) => call("LEN", [input]);
    const mod = (input, divisor) => call("MOD", [input, String(divisor)]);

    const escapeRegexLiteral = (value) =>
        String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");

    const escapeCharClass = (value) =>
        String(value).replace(/[\\\]^\-]/g, "\\$&");

    const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");
    const bits = (n, width) => n.toString(2).padStart(width, "0");

    const percentBytePattern = (n) =>
    {
        const hex = hex2(n);

        // Match both uppercase and lowercase percent escapes, e.g. %F0 or %f0.
        return (
            "%" +
            hex
                .split("")
                .map((char) =>
                    /[A-F]/.test(char) ? `[${char}${char.toLowerCase()}]` : char,
                )
                .join("")
        );
    };

    const encodeURIComponentSafeChars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()";

    const literalSafePatternByByte = new Map();

    for (const char of encodeURIComponentSafeChars) {
        literalSafePatternByByte.set(
            char.codePointAt(0),
            escapeRegexLiteral(char),
        );
    }

    const bytePattern = (n) =>
    {
        const percent = percentBytePattern(n);
        const literal = literalSafePatternByByte.get(n);

        // ENCODE_URL_COMPONENT leaves these ASCII characters unescaped,
        // so they need to be matched as literal source units as well.
        return literal ? `(?:${percent}|${literal})` : percent;
    };

    const makeConditionalTokenFormula = ({
        input,
        entries,
        groupName,
        groupPrefix,
        outputDelimiterForTrim = outputDelimiter,
    }) =>
    {
        const matchPattern =
            `(?P<${groupName}>` +
            entries
                .map((entry, index) => `(?P<${groupPrefix}${index}>${entry.pattern})`)
                .join("|") +
            `)`;

        const replacementPattern =
            tokenStart +
            entries
                .map(
                    (entry, index) =>
                        `${markerOpen}$<${groupPrefix}${index}>${markerClose}?${entry.output}`,
                )
                .join(candidateDelimiter) +
            tokenEnd;

        const forbiddenTokenChars = tokenStart + tokenEnd + candidateDelimiter;
        const tokenBody = `[^${escapeCharClass(forbiddenTokenChars)}]*`;

        const cleanupPattern =
            escapeRegexLiteral(tokenStart) +
            `(?:${escapeRegexLiteral(markerOpen)}${escapeRegexLiteral(markerClose)}\\?${tokenBody}${escapeRegexLiteral(candidateDelimiter)})*` +
            `${escapeRegexLiteral(markerOpen)}[\\s\\S]+?${escapeRegexLiteral(markerClose)}\\?(${tokenBody})` +
            `(?:${escapeRegexLiteral(candidateDelimiter)}${escapeRegexLiteral(markerOpen)}${escapeRegexLiteral(markerClose)}\\?${tokenBody})*` +
            escapeRegexLiteral(tokenEnd);

        const tokenized = regexReplace(input, matchPattern, replacementPattern);
        let body = regexReplace(tokenized, cleanupPattern, "$1");

        if (trimTrailingDelimiter && outputDelimiterForTrim) {
            body = regexReplace(
                body,
                `${escapeRegexLiteral(outputDelimiterForTrim)}$`,
                "",
            );
        }

        return body;
    };

    const byteEntries = Array.from({ length: 256 }, (_, n) => ({
        byte: n,
        pattern: bytePattern(n),
    }));

    if (format === "hex") {
        return makeConditionalTokenFormula({
            input: encodedExpr,
            entries: byteEntries.map(({ byte, pattern }) => ({
                pattern,
                output: `${hex2(byte)}${outputDelimiter}`,
            })),
            groupName: "UTF8_HEX_BYTE",
            groupPrefix: "h",
        });
    }

    if (format === "binary") {
        return makeConditionalTokenFormula({
            input: encodedExpr,
            entries: byteEntries.map(({ byte, pattern }) => ({
                pattern,
                output: `${bits(byte, 8)}${outputDelimiter}`,
            })),
            groupName: "UTF8_BINARY_BYTE",
            groupPrefix: "b",
        });
    }

    // Base64 path:
    // ENCODE_URL_COMPONENT(source)
    // -> UTF-8 bytes as continuous binary
    // -> pad binary to a 6-bit boundary
    // -> tokenize 6-bit chunks into Base64 alphabet
    const binary = makeConditionalTokenFormula({
        input: encodedExpr,
        entries: byteEntries.map(({ byte, pattern }) => ({
            pattern,
            output: bits(byte, 8),
        })),
        groupName: "UTF8_BINARY_BYTE",
        groupPrefix: "b",
        outputDelimiterForTrim: "",
    });

    const bitRemainder = mod(len(binary), 24);

    const bitPadding = call("SWITCH", [
        bitRemainder,
        "0",
        q(""),
        "8",
        q("0000"),
        "16",
        q("00"),
    ]);

    const equalsPadding = call("SWITCH", [
        bitRemainder,
        "0",
        q(""),
        "8",
        q("=="),
        "16",
        q("="),
    ]);

    const paddedBinary = minify
        ? `${wrap(binary)}&${bitPadding}`
        : `${wrap(binary)} & ${bitPadding}`;

    const base64Body = makeConditionalTokenFormula({
        input: paddedBinary,
        entries: Array.from({ length: 64 }, (_, n) => ({
            pattern: bits(n, 6),
            output: `${BASE64[n]}${outputDelimiter}`,
        })),
        groupName: "BASE64_CHUNK",
        groupPrefix: "c",
    });

    return minify
        ? `${base64Body}&${equalsPadding}`
        : `${base64Body} & ${equalsPadding}`;
};
