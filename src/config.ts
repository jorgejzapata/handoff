// App-wide settings that aren't secret.

// Where students reach you: shown in Account settings, Support and the
// suspended-account page. Apple requires a working support contact.
// Set this before launch, e.g. 'support@yourdomain.com'.
export const SUPPORT_EMAIL = 'jorgejaden@gmail.com'

// Who runs Handoff, as named in the Terms and Privacy Policy. Change this to
// the company's legal name if Handoff becomes an LLC.
export const OPERATOR_NAME = 'Jorge Zapata'

// Effective date shown on the Terms, Privacy Policy and Safety Guidelines.
// Update it whenever their substance changes.
export const LEGAL_EFFECTIVE_DATE = 'October 10, 2026'

// The one area Handoff serves for now. Maps center here, address search stays
// inside the box, and "distance to campus" is measured from the point.
// Multi-campus support will replace this with a list.
export const SERVICE_AREA = {
  campus: { lat: 40.5734, lng: -105.0843 },
  city: 'Fort Collins, CO',
  bbox: '-105.25,40.45,-104.95,40.68', // west,south,east,north
}

// Internal ID stamped on users and listings (not shown anywhere). Changing it
// needs a data migration, so it stays until multi-campus is designed.
export const MARKET_ID = 'csu'
