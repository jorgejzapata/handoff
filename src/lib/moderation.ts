// A basic respectful-language filter. It hides slurs and a few phrases of
// targeted abuse in messages and listings, and tells the sender "Keep it
// friendly." Ordinary swearing is left alone, and words that communities have
// reclaimed (like "queer") are never hidden.
//
// This is a first line of defense, not moderation by itself: reports and the
// admin queue handle the rest. Keep the list short and specific, since every
// entry here risks hiding something harmless.

// Base spellings. Matching also catches common look-alike characters
// (a→@/4, e→3, i→1/!, o→0, s→$/5) and stretched letters ("fagggot").
const BLOCKED = [
  // Racial and ethnic slurs
  'nigger', 'nigga', 'niggas', 'niggers', 'chink', 'chinks', 'gook', 'gooks', 'spic', 'spics', 'wetback', 'wetbacks',
  'beaner', 'beaners', 'kike', 'kikes', 'raghead', 'ragheads', 'towelhead', 'towelheads', 'sandnigger', 'paki',
  'pakis', 'coon', 'coons', 'jigaboo', 'zipperhead',
  // Anti-LGBTQ+ slurs
  'fag', 'fags', 'faggot', 'faggots', 'tranny', 'trannies', 'shemale', 'shemales',
  // Ableist slurs
  'retard', 'retards', 'retarded',
  // Targeted abuse
  'kys', 'kill yourself', 'kill urself',
]

const LOOKALIKE: Record<string, string> = {
  a: '[a@4]',
  e: '[e3]',
  i: '[i1!|l]',
  o: '[o0]',
  s: '[s$5z]',
  g: '[g9]',
  t: '[t7+]',
}

function wordPattern(word: string) {
  return word
    .split('')
    .map((ch) => (ch === ' ' ? '[\\s._-]+' : `${LOOKALIKE[ch] ?? ch}+`))
    .join('')
}

// Not inside a longer word, so "spice", "cocoon" and "Scunthorpe" are safe.
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(?:${BLOCKED.map(wordPattern).join('|')})(?![\\p{L}\\p{N}])`, 'giu')

export function hasBlockedLanguage(text: string) {
  PATTERN.lastIndex = 0
  return PATTERN.test(text)
}

// Replaces each blocked word with asterisks of the same length.
export function maskBlockedLanguage(text: string) {
  return text.replace(PATTERN, (m) => m.replace(/[^\s]/g, '*'))
}

export const KEEP_IT_FRIENDLY = "Keep it friendly. We hid a word that isn't allowed on Handoff."
