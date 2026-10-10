import { useEffect, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { fetchProfile } from './users'

// A student's own gender lives on their private users doc. Only they can read
// it; Handoff uses it to show places that are open to them.
export type Gender = 'woman' | 'man' | 'nonbinary' | 'self'

export const GENDERS: [Gender, string][] = [
  ['woman', 'Woman'],
  ['man', 'Man'],
  ['nonbinary', 'Non-binary'],
  ['self', 'Let me describe it'],
]

export const GENDER_SELF_MAX = 30

// Groups a room listing can say live there, or are welcome to move in.
// "Women" and "Men" include trans and cis people alike.
export type Group = 'women' | 'men' | 'nonbinary'

export const GROUPS: [Group, string][] = [
  ['women', 'Women'],
  ['men', 'Men'],
  ['nonbinary', 'Non-binary people'],
]

const lower: Record<Group, string> = { women: 'women', men: 'men', nonbinary: 'non-binary people' }

export function genderToGroup(g?: string): Group | undefined {
  return g === 'woman' ? 'women' : g === 'man' ? 'men' : g === 'nonbinary' ? 'nonbinary' : undefined
}

function joinAnd(parts: string[]) {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function ordered(groups: Group[]) {
  return GROUPS.map(([g]) => g).filter((g) => groups.includes(g))
}

// Empty, or every group picked, means anyone.
export function isOpenToAnyone(openTo?: Group[]) {
  return !openTo || openTo.length === 0 || openTo.length === GROUPS.length
}

export function openToLabel(openTo?: Group[]) {
  if (isOpenToAnyone(openTo)) return 'Open to anyone'
  return `Open to ${joinAnd(ordered(openTo!).map((g) => lower[g]))}`
}

// "3 roommates: men" / "2 roommates: women and non-binary people"
export function householdLabel(count: number, groups?: Group[]) {
  const people = `${count} ${count === 1 ? 'roommate' : 'roommates'}`
  if (count === 0 || !groups || groups.length === 0) return people
  return `${people}: ${joinAnd(ordered(groups).map((g) => lower[g]))}`
}

export function openToGroup(openTo: Group[] | undefined, group: Group) {
  return isOpenToAnyone(openTo) || openTo!.includes(group)
}

// The signed-in student's group, if they've set a gender that maps to one.
let cache: { uid: string; group: Group | undefined } | null = null

export function invalidateMyGroup() {
  cache = null
}

export function useMyGroup() {
  const { user } = useAuth()
  const uid = user && !user.isAnonymous ? user.uid : null
  const [group, setGroup] = useState<Group | undefined>(cache && cache.uid === uid ? cache.group : undefined)
  useEffect(() => {
    if (!uid) return setGroup(undefined)
    if (cache?.uid === uid) return setGroup(cache.group)
    let live = true
    fetchProfile(uid).then((p) => {
      const g = genderToGroup(p?.gender)
      cache = { uid, group: g }
      if (live) setGroup(g)
    })
    return () => {
      live = false
    }
  }, [uid])
  return group
}
