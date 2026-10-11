import { Link } from 'react-router'
import { Check, KeyRound, Search, ShieldCheck, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { Footer } from '../components/Shell'
import { BOOST_GATE, TIERS, formatCents, priceFor } from '../lib/boosts'
import {
  FREE_LISTINGS,
  LISTING_FEE_CENTS,
  boostsUnlocked,
  freeSpotsLeft,
  listingFeeApplies,
  useListingStats,
} from '../lib/pricing'

// /pricing: everything Handoff charges, on one page, before anyone pays.
export default function Pricing() {
  const stats = useListingStats()
  const feeOn = listingFeeApplies(stats)
  const left = stats ? freeSpotsLeft(stats) : FREE_LISTINGS
  const fee = formatCents(LISTING_FEE_CENTS)

  return (
    <div className="page pricing">
      <header className="pricing-head">
        <p className="eyebrow">Pricing</p>
        <h1 className="display">
          <span>Free to look.</span> <span>Cheap to post.</span>
        </h1>
        <p className="lead">Finding a place never costs anything. Posting one costs a dollar at most.</p>
      </header>

      <div className="pricing-grid">
        <PriceCard
          icon={<Search size={22} strokeWidth={1.5} />}
          title="Finding a place"
          price="Free"
          note="Always"
          points={['Browse every listing', 'Save places', 'Message listers as much as you like']}
        />

        <PriceCard
          icon={<KeyRound size={22} strokeWidth={1.5} />}
          title="Posting your place"
          price={feeOn ? fee : 'Free'}
          note={feeOn ? 'One time, per listing' : `For the first ${FREE_LISTINGS} places`}
          points={[
            feeOn ? 'Pay once when you publish' : `Then ${fee} one time, per listing`,
            'Edit, share and mark it filled for free',
            'Relisting a place you already posted is free',
          ]}
          footer={
            !feeOn && stats && left > 0 ? (
              <span className="caption pricing-flag">
                {left === 1 ? '1 free spot left' : `${left} of ${FREE_LISTINGS} free spots left`}
              </span>
            ) : undefined
          }
        />

        <PriceCard
          icon={<Zap size={22} strokeWidth={1.5} />}
          title="Boosts"
          price={formatCents(TIERS['7d'].cents)}
          priceSuffix="/ 7 days"
          note={`or ${formatCents(TIERS['30d'].cents)} for 30 days. Optional.`}
          points={[
            'Your place shows first in Browse',
            'A Boosted tag on your listing',
            `Verified students pay ${formatCents(priceFor('7d', true))} and ${formatCents(priceFor('30d', true))} (20% off)`,
          ]}
          footer={
            !boostsUnlocked(stats) ? (
              <span className="caption muted">Opens once Handoff has {BOOST_GATE} live places.</span>
            ) : (
              <span className="caption muted">More eyes on your place. It can’t guarantee messages.</span>
            )
          }
        />
      </div>

      <section className="notice pricing-never">
        <ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <p className="notice-title">Handoff never touches your rent or deposit.</p>
          <p className="caption muted">
            Those go between you, the lister and the landlord. Handoff will never ask you to pay in chat.{' '}
            <Link to="/safety" className="text-link">
              Safety tips
            </Link>
          </p>
        </div>
      </section>

      <section className="pricing-faq">
        <h2 className="heading">Good to know</h2>
        <dl>
          <dt>Why charge {fee} at all?</dt>
          <dd>It keeps fake listings and scams out. Posting stays nearly free for real students.</dd>
          <dt>When do I pay?</dt>
          <dd>Only at Publish, and you see the price first. Your draft saves either way, with no card needed to start.</dd>
          <dt>How do I get the student price?</dt>
          <dd>
            Confirm a .edu email in{' '}
            <Link to="/account" className="text-link">
              Account settings
            </Link>
            . It also adds a Verified student badge to your listings.
          </dd>
        </dl>
      </section>

      <div className="pricing-cta">
        <Link to="/post" className="btn btn-accent">
          Post your place
        </Link>
        <Link to="/listings" className="btn btn-secondary">
          Browse places
        </Link>
      </div>

      <Footer />
    </div>
  )
}

function PriceCard({
  icon,
  title,
  price,
  priceSuffix,
  note,
  points,
  footer,
}: {
  icon: ReactNode
  title: string
  price: string
  priceSuffix?: string
  note: string
  points: string[]
  footer?: ReactNode
}) {
  return (
    <section className="card price-card">
      <span className="lister-icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="heading">{title}</h2>
      <p className="price-card-price">
        <span className="price-big">{price}</span>
        {priceSuffix && <span className="muted"> {priceSuffix}</span>}
      </p>
      <p className="caption muted">{note}</p>
      <ul className="fee-points">
        {points.map((t) => (
          <li key={t}>
            <Check size={16} strokeWidth={2} aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
      {footer}
    </section>
  )
}
