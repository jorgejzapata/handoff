import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

// Every night, live listings past their expiry date (3 months, or the
// move-out date if sooner) are marked expired, so they leave Browse and show
// under Past in My listings with a Relist button.
export const expireListings = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'America/Denver', region: 'us-central1', memory: '256MiB' },
  async () => {
    const db = getFirestore()
    const due = await db
      .collection('listings')
      .where('status', '==', 'active')
      .where('expiresAt', '<=', Timestamp.now())
      .limit(500)
      .get()
    for (let i = 0; i < due.docs.length; i += 400) {
      const batch = db.batch()
      for (const d of due.docs.slice(i, i + 400))
        batch.update(d.ref, { status: 'expired', updatedAt: FieldValue.serverTimestamp() })
      await batch.commit()
    }
    logger.info(`Expired ${due.size} listings`)
  },
)
