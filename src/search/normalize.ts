/**
 * Fold a string for searching: lowercase, strip diacritics, collapse whitespace.
 *
 * Deliberately does NOT tokenise on word boundaries — the library is largely
 * Chinese (赤伶), and Han text has no spaces, so substring matching is the only
 * thing that works across both scripts.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when every whitespace-separated term in `query` appears in `haystack`. */
export function matches(haystack: string, query: string): boolean {
  const q = normalize(query)
  if (q === '') return true
  const h = normalize(haystack)
  return q.split(' ').every((term) => h.includes(term))
}
