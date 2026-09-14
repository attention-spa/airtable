export type Rune = number; // Code-point values in Unicode 4.0 are 21 bits wide.

export const UTFmax = 4;       // maximum bytes per rune
export const Runesync = 0x80;  // cannot represent part of a UTF sequence (<)
export const Runeself = 0x80;  // rune and UTF sequences are the same (<)
export const Runeerror = 0xFFFD; // decoding error in UTF
export const Runemax = 0x10FFFF; // maximum rune value

export function runetochar(s: Uint8Array, r: Rune[]): number {
  // Converts a Rune to UTF-8 bytes and writes to s.
  // Returns number of bytes written.
  const rune = r[0];
  if (rune < 0 || rune > Runemax) {
    s[0] = 0xEF;
    s[1] = 0xBF;
    s[2] = 0xBD;
    return 3;
  }
  if (rune < 0x80) {
    s[0] = rune;
    return 1;
  }
  if (rune < 0x800) {
    s[0] = 0xC0 | (rune >> 6);
    s[1] = 0x80 | (rune & 0x3F);
    return 2;
  }
  if (rune < 0x10000) {
    s[0] = 0xE0 | (rune >> 12);
    s[1] = 0x80 | ((rune >> 6) & 0x3F);
    s[2] = 0x80 | (rune & 0x3F);
    return 3;
  }
  s[0] = 0xF0 | (rune >> 18);
  s[1] = 0x80 | ((rune >> 12) & 0x3F);
  s[2] = 0x80 | ((rune >> 6) & 0x3F);
  s[3] = 0x80 | (rune & 0x3F);
  return 4;
}

export function chartorune(r: Rune[], s: Uint8Array): number {
  // Decodes UTF-8 bytes from s into a Rune stored in r[0].
  // Returns number of bytes consumed.
  const c0 = s[0];
  if (c0 < 0x80) {
    r[0] = c0;
    return 1;
  }
  if (c0 < 0xC0) {
    r[0] = Runeerror;
    return 1;
  }
  if (c0 < 0xE0) {
    if (s.length < 2) {
      r[0] = Runeerror;
      return 1;
    }
    const c1 = s[1];
    if ((c1 & 0xC0) !== 0x80) {
      r[0] = Runeerror;
      return 1;
    }
    const rune = ((c0 & 0x1F) << 6) | (c1 & 0x3F);
    if (rune < 0x80) {
      r[0] = Runeerror;
      return 1;
    }
    r[0] = rune;
    return 2;
  }
  if (c0 < 0xF0) {
    if (s.length < 3) {
      r[0] = Runeerror;
      return 1;
    }
    const c1 = s[1], c2 = s[2];
    if ((c1 & 0xC0) !== 0x80 || (c2 & 0xC0) !== 0x80) {
      r[0] = Runeerror;
      return 1;
    }
    const rune = ((c0 & 0x0F) << 12) | ((c1 & 0x3F) << 6) | (c2 & 0x3F);
    if (rune < 0x800 || (rune >= 0xD800 && rune <= 0xDFFF)) {
      r[0] = Runeerror;
      return 1;
    }
    r[0] = rune;
    return 3;
  }
  if (c0 < 0xF8) {
    if (s.length < 4) {
      r[0] = Runeerror;
      return 1;
    }
    const c1 = s[1], c2 = s[2], c3 = s[3];
    if ((c1 & 0xC0) !== 0x80 || (c2 & 0xC0) !== 0x80 || (c3 & 0xC0) !== 0x80) {
      r[0] = Runeerror;
      return 1;
    }
    const rune = ((c0 & 0x07) << 18) | ((c1 & 0x3F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F);
    if (rune < 0x10000 || rune > Runemax) {
      r[0] = Runeerror;
      return 1;
    }
    r[0] = rune;
    return 4;
  }
  r[0] = Runeerror;
  return 1;
}

export function fullrune(s: Uint8Array, n: number): boolean {
  // Reports whether the first n bytes of s contain a full UTF-8 encoding of a rune.
  if (n === 0) return false;
  const c0 = s[0];
  if (c0 < 0x80) return true;
  if (c0 < 0xC0) return false;
  if (c0 < 0xE0) return n >= 2;
  if (c0 < 0xF0) return n >= 3;
  if (c0 < 0xF8) return n >= 4;
  return false;
}

export function utflen(s: Uint8Array): number {
  // Returns the number of runes in the UTF-8 encoded byte array s.
  let i = 0;
  let count = 0;
  while (i < s.length) {
    const c = s[i];
    let size = 0;
    if (c < 0x80) size = 1;
    else if (c < 0xE0) size = 2;
    else if (c < 0xF0) size = 3;
    else if (c < 0xF8) size = 4;
    else {
      // Invalid byte, count as one rune error
      size = 1;
    }
    if (!fullrune(s.subarray(i), size)) break;
    i += size;
    count++;
  }
  return count;
}

export function utfrune(s: Uint8Array, r: Rune): number | null {
  // Returns the index of the first occurrence of rune r in UTF-8 bytes s, or null if not found.
  let i = 0;
  while (i < s.length) {
    const runeArr: Rune[] = [0];
    const size = chartorune(runeArr, s.subarray(i));
    if (runeArr[0] === r) return i;
    i += size;
  }
  return null;
}