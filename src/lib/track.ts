import { logEvent, setUserId, setUserProperties } from 'firebase/analytics'
import { getAnalyticsIfAllowed } from './firebase'
import type { Listing } from './listings'

// One place for every GA4 event. Event names match the MVP spec's table so
// GA4 funnels and the metricsDaily rollup speak the same language.
//
// Rules (Google's terms and our privacy policy): never send names, emails,
// phone numbers, addresses, street names or message text. Listing IDs, rent,
// dates, room type and neighborhood are fine.

export type EventName =
  // Onboarding
  | 'signup_sheet_opened'
  | 'sign_up'
  | 'login'
  | 'school_email_verified'
  | 'profile_completed'
  | 'app_installed'
  // Supply
  | 'post_started'
  | 'post_step_completed'
  | 'photo_uploaded'
  | 'listing_published'
  | 'listing_edited'
  | 'listing_relisted'
  // Demand
  | 'filter_applied'
  | 'listing_viewed'
  | 'listing_saved'
  | 'share'
  // Chat
  | 'first_message_sent'
  | 'message_sent'
  | 'address_shared'
  | 'user_blocked'
  // Money
  | 'boost_viewed'
  | 'boost_checkout_started'
  | 'boost_purchased'
  | 'boost_failed'
  | 'listing_fee_viewed'
  | 'listing_fee_checkout_started'
  | 'listing_fee_paid'
  | 'listing_fee_failed'
  // Outcome and trust
  | 'listing_filled'
  | 'report_submitted'
  // Errors
  | 'app_error'
  | 'screen_view'

type Params = Record<string, string | number | boolean | undefined>

export function track(name: EventName, params: Params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined))
  if (import.meta.env.DEV) console.debug('[track]', name, clean)
  void getAnalyticsIfAllowed()
    .then((a) => a && logEvent(a, name as string, clean))
    .catch(() => {})
}

// Safe, non-personal fields about a listing, for any listing event.
export function listingParams(l: Pick<Listing, 'id' | 'listingType' | 'rentCents' | 'boosted'> & { neighborhood?: string }) {
  return {
    listing_id: l.id,
    listing_type: l.listingType,
    rent_usd: Math.round(l.rentCents / 100),
    boosted: l.boosted,
    neighborhood: l.neighborhood,
  }
}

// Screen views with clean names ("browse", "listing_detail", "post_step_3").
const SCREENS: [RegExp, string][] = [
  [/^\/$/, 'home'],
  [/^\/listings\/?$/, 'browse'],
  [/^\/listings\/[^/]+$/, 'listing_detail'],
  [/^\/post\/live\//, 'post_live'],
  [/^\/post\/checkout\//, 'listing_fee'],
  [/^\/post/, 'post'],
  [/^\/messages\/?$/, 'messages'],
  [/^\/messages\/[^/]+$/, 'thread'],
  [/^\/saved/, 'saved'],
  [/^\/me\/listings\/[^/]+\/edit/, 'edit_listing'],
  [/^\/me\/listings\/[^/]+\/boost/, 'boost'],
  [/^\/me\/listings/, 'my_listings'],
  [/^\/me\/?$/, 'me'],
  [/^\/account/, 'account'],
  [/^\/boost\/success/, 'boost_success'],
  [/^\/boost\/cancel/, 'boost_cancel'],
  [/^\/verif/, 'verify'],
  [/^\/confirm-email/, 'confirm_email'],
  [/^\/onboarding/, 'profile_setup'],
  [/^\/admin/, 'admin'],
  [/^\/pricing/, 'pricing'],
  [/^\/(terms|privacy|safety|support|delete-account)/, 'legal'],
]

export function screenName(path: string) {
  return SCREENS.find(([re]) => re.test(path))?.[1] ?? 'not_found'
}

export function trackScreen(path: string, step?: number) {
  const name = step ? `post_step_${step}` : screenName(path)
  track('screen_view', { screen_name: name, firebase_screen: name })
}

// User ID is the Firebase UID, never an email. Properties come from our own data.
export function identify(
  uid: string | null,
  props: { verified?: boolean; class_year?: string; role?: string; age_bracket?: string; gender?: string } = {},
) {
  void getAnalyticsIfAllowed()
    .then((a) => {
      if (!a) return
      setUserId(a, uid)
      const p = Object.fromEntries(
        Object.entries({ ...props, platform: isStandalone() ? 'pwa' : 'web', school: 'csu' }).filter(([, v]) => v !== undefined),
      )
      setUserProperties(a, p)
    })
    .catch(() => {})
}

function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

// GA4 bucket for age, from birth year. Never send the year itself.
export function ageBracket(birthYear?: number, now = new Date()) {
  if (!birthYear) return undefined
  const age = now.getFullYear() - birthYear
  if (age < 18) return undefined
  if (age <= 20) return '18-20'
  if (age <= 24) return '21-24'
  if (age <= 34) return '25-34'
  if (age <= 44) return '35-44'
  return '45+'
}

// UTM tags on every shared listing link, so group-chat traffic shows up as
// its own channel in GA4.
export function withShareUtm(url: string, medium: 'listing_link' | 'publish_success' | 'home' = 'listing_link') {
  const u = new URL(url, window.location.origin)
  u.searchParams.set('utm_source', 'share')
  u.searchParams.set('utm_medium', medium)
  return u.toString()
}
