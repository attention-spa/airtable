/// <reference lib="webworker"/>
import { FieldType as ft, FieldData } from '@airtable/blocks/dist/types/src/types/field';

/** @module dddominikk/airtable/scripting */

/**
 * @typedef {SourceField|FilesField} Supported_Fields
 * @typedef {aiTextField|formulaField|multilineTextField|richTextField|rollupField|singleLineTextField|urlField} SourceField
 * @typedef {multipleAttachmentsField} FilesField
 */

/** For text-to-attachment functionality. */
const supportedFields = {
    source: [ft.RICH_TEXT, ft.BARCODE, ft.MULTILINE_TEXT, ft.FORMULA, ft.ROLLUP, ft.SINGLE_LINE_TEXT, ft.URL],
    files: [ft.MULTIPLE_ATTACHMENTS]
};

/**
 * @typedef {`${'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y'|'Z'}`} ALPHABET
 * @typedef {`${ALPHABET|Lowercase<ALPHABET>|0|1|2|3|4|5|6|7|8|9}`} AlphanumericCharacter A case-insensitive alphanumeric string validator.
 * @typedef {AlphanumericCharacter} C
 **/