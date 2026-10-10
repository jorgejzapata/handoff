import { auth } from './firebase'
import { createDraft, fetchDraft } from './listings'
import type { ListingDraft } from './listings'

// Which draft this device is working on. The draft itself lives in Firestore.
const POINTER_KEY = 'handoff:draft-id'
const NOTICE_KEY = 'handoff:draft-notice'

export function getDraftPointer() {
  try {
    return localStorage.getItem(POINTER_KEY)
  } catch {
    return null
  }
}

export function setDraftPointer(id: string | null) {
  try {
    if (id) localStorage.setItem(POINTER_KEY, id)
    else localStorage.removeItem(POINTER_KEY)
  } catch {
    /* storage unavailable */
  }
}

export function takeDraftNotice() {
  try {
    const n = localStorage.getItem(NOTICE_KEY)
    localStorage.removeItem(NOTICE_KEY)
    return n
  } catch {
    return null
  }
}

// Called before switching from an anonymous account to an existing one.
export async function captureAnonDraft(): Promise<ListingDraft | null> {
  const user = auth.currentUser
  const id = getDraftPointer()
  if (!user?.isAnonymous || !id) return null
  return fetchDraft(id, user.uid)
}

// Recreates the draft under the account just signed in to. Photos stay behind,
// since they belong to the old anonymous account's folder.
export async function restoreDraft(draft: ListingDraft | null, uid: string) {
  if (!draft) return
  try {
    const { photos, ...rest } = draft
    const id = await createDraft(uid, rest)
    setDraftPointer(id)
    if (photos?.length) localStorage.setItem(NOTICE_KEY, 'Your draft came with you. Add your photos again.')
  } catch (e) {
    console.error('[handoff] restoring draft', e)
  }
}
