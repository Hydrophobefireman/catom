// Murmur2 hash (from emotion-js)
// https://github.com/emotion-js/emotion/blob/master/packages/hash/src/index.js
export function murmur2(str: string): string {
  let h = 0
  let k: number
  let i = 0
  let len = str.length

  for (; len >= 4; ++i, len -= 4) {
    k =
      (str.charCodeAt(i) & 0xff) |
      ((str.charCodeAt(++i) & 0xff) << 8) |
      ((str.charCodeAt(++i) & 0xff) << 16) |
      ((str.charCodeAt(++i) & 0xff) << 24)

    k =
      /* Math.imul(k, m): */
      (k & 0xffff) * 0x5bd1e995 + (((k >>> 16) * 0xe995) << 16)
    k ^= /* k >>> r: */ k >>> 24

    h =
      /* Math.imul(k, m): */
      ((k & 0xffff) * 0x5bd1e995 + (((k >>> 16) * 0xe995) << 16)) ^
      /* Math.imul(h, m): */
      ((h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0xe995) << 16))
  }

  if (len >= 3) h ^= (str.charCodeAt(i + 2) & 0xff) << 16
  if (len >= 2) h ^= (str.charCodeAt(i + 1) & 0xff) << 8
  if (len >= 1) {
    h ^= str.charCodeAt(i) & 0xff
    h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0xe995) << 16)
  }

  h ^= h >>> 13
  h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0xe995) << 16)

  return ((h ^ (h >>> 15)) >>> 0).toString(36)
}

const PREFIX_CHARS = new Set('0123456789-'.split(''))

export function makeCSSCompatible(hash: string): string {
  if (PREFIX_CHARS.has(hash[0])) {
    return `_${hash}`
  }
  return hash
}

export function generateHash(identity: string): string {
  return makeCSSCompatible(murmur2(identity))
}
