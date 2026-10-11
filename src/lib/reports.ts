import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { track } from './track'

export type ReportTarget = 'listing' | 'user' | 'message'
export type ReportReason = 'scam' | 'money-before-viewing' | 'fake' | 'unavailable' | 'offensive' | 'other'

export const REPORT_REASONS: [ReportReason, string][] = [
  ['scam', 'Looks like a scam'],
  ['money-before-viewing', 'Asking for money before a viewing'],
  ['fake', 'Photos or details are fake'],
  ['unavailable', "Place isn't really available"],
  ['offensive', 'Offensive or inappropriate'],
  ['other', 'Something else'],
]

export async function submitReport(reporterId: string, targetType: ReportTarget, targetId: string, reason: ReportReason, details: string) {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    targetType,
    targetId,
    reason,
    details: details.trim().slice(0, 500),
    status: 'open',
    createdAt: serverTimestamp(),
  })
  track('report_submitted', { target_type: targetType, reason })
}
