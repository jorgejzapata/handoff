import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from './firebase'

// Listing views: one per visitor per day, stored at
// listings/{id}/views/{yyyymmdd}_{visitorId}. Visitors can only create; only
// the lister can read them. The lister's own visits never count.

const VISITOR_KEY = 'handoff:visitor-id'

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '').slice(0, 20)
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
  }
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

const recorded = new Set<string>()

export async function recordView(listingId: string, ownerId: string, viewerUid?: string) {
  if (viewerUid && viewerUid === ownerId) return
  const id = `${dayKey()}_${visitorId()}`
  const key = `${listingId}/${id}`
  if (recorded.has(key)) return
  recorded.add(key)
  // A second visit the same day is rejected by the rules (no updates), which is the point.
  await setDoc(doc(db, 'listings', listingId, 'views', id), { day: id.slice(0, 8), at: serverTimestamp() }).catch(() => {})
}

export interface ViewStats {
  total: number
  byDay: { day: string; label: string; count: number }[] // oldest first, 7 days
}

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: 'UTC' })

export async function fetchViewStats(listingId: string): Promise<ViewStats> {
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000))
  const keys = days.map((d) => dayKey(d))
  const snap = await getDocs(query(collection(db, 'listings', listingId, 'views'), where('day', '>=', keys[0])))
  const counts = new Map<string, number>()
  for (const d of snap.docs) {
    const day = d.data().day as string
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const byDay = keys.map((k, i) => ({ day: k, label: weekday.format(days[i]), count: counts.get(k) ?? 0 }))
  return { total: byDay.reduce((n, d) => n + d.count, 0), byDay }
}
