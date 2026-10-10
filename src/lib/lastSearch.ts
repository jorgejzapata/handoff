// The seeker's last searched dates, kept on this device. Prefills Home's
// search and the Say hi message.
const KEY = 'handoff:last-search'

export interface LastSearch {
  from?: string
  to?: string
  max?: string
  type?: string
}

export function readLastSearch(): LastSearch {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as LastSearch
  } catch {
    return {}
  }
}

export function saveLastSearch(s: LastSearch) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}
