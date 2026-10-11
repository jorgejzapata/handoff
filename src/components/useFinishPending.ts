import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import type { User } from 'firebase/auth'
import { clearPending, readPending } from './AuthProvider'
import { useToast } from './Toast'
import { getDraftPointer } from '../lib/draftCarry'
import { fetchListing, listerSince, publishDraftById } from '../lib/listings'
import { savePendingListing } from '../lib/saved'
import { findMyConversation, startConversation } from '../lib/messages'
import { isVerifiedStudent } from '../lib/auth'
import { profileStepThen } from '../lib/users'
import { fetchListingStats, listingFeeApplies } from '../lib/pricing'

// Right after signing up or logging in, finish what they were doing when the
// sign-up sheet opened: send the first message, publish the listing, or save
// the place. No email to wait on.
export function useFinishPending() {
  const navigate = useNavigate()
  const toast = useToast()

  return useCallback(
    async (user: User, { welcome }: { welcome: string }) => {
      const pending = readPending()
      clearPending()

      if (pending?.reason === 'publish') {
        const id = getDraftPointer() ?? pending.listingId
        // Past the free spots: back to the wizard's $1 step, never a silent charge.
        if (id && listingFeeApplies(await fetchListingStats())) {
          toast(`${welcome} One last step to publish.`)
          navigate('/post?checkout=1', { replace: true })
          return
        }
        try {
          const live =
            !!id &&
            (await publishDraftById(id, user.uid, {
              firstName: user.displayName || 'A student',
              since: listerSince(user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date()),
              verified: isVerifiedStudent(user),
            }))
          if (live) {
            navigate(`/post/live/${id}`, { replace: true })
            return
          }
          toast('Almost there. Finish the missing parts, then publish.')
        } catch (e) {
          console.error('[handoff] publish after signup', e)
          toast("Couldn't publish yet. Check your listing and try again.")
        }
        navigate('/post', { replace: true })
        return
      }

      if (pending?.reason === 'say-hi' && pending.listingId && pending.message) {
        try {
          const existing = await findMyConversation(pending.listingId, user.uid)
          if (existing) {
            navigate(`/messages/${existing}`, { replace: true })
            return
          }
          const listing = await fetchListing(pending.listingId)
          if (listing?.status === 'active') {
            const id = await startConversation(listing, user, pending.message)
            toast(`${welcome} Your message to ${listing.lister.firstName} is sent.`)
            navigate(await profileStepThen(user.uid, `/messages/${id}`), { replace: true })
            return
          }
          toast('That place is no longer available.')
        } catch (e) {
          console.error('[handoff] say hi after signup', e)
          toast(`${welcome} The message didn't send, so try Say hi again.`)
        }
        if (pending.returnTo) navigate(pending.returnTo, { replace: true })
        return
      }

      if (pending?.reason === 'save' && pending.listingId) {
        const ok = await savePendingListing(user.uid, pending.listingId).catch(() => false)
        toast(ok ? `${welcome} That place is in Saved.` : welcome)
        return
      }

      if (pending?.reason === 'messages') {
        toast(welcome)
        navigate('/messages', { replace: true })
        return
      }

      toast(welcome)
    },
    [navigate, toast],
  )
}
