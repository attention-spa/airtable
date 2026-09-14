export function prefixSuccessor(prefix: string): string {
  const chars = Array.from(prefix);
  while (chars.length > 0) {
    const lastIndex = chars.length - 1;
    if (chars[lastIndex].charCodeAt(0) === 0xff) {
      chars.pop();
    } else {
      chars[lastIndex] = String.fromCharCode(chars[lastIndex].charCodeAt(0) + 1);
      break;
    }
  }
  return chars.join('');
}