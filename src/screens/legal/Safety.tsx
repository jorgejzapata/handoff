import { Link } from 'react-router'
import { SUPPORT_EMAIL } from '../../config'
import { Ext, LegalDoc, Mail } from './LegalDoc'
import type { LegalSection } from './LegalDoc'

function Tel({ n, label }: { n: string; label?: string }) {
  return <a href={`tel:${n.replace(/[^0-9+]/g, '')}`}>{label ?? n}</a>
}

const sections: LegalSection[] = [
  {
    id: 'payments',
    title: 'Protecting Yourself from Fraud',
    body: (
      <>
        <p>
          Rental fraud often involves pressure to pay quickly for a place you have not seen. To reduce your risk, we
          strongly recommend that you:
        </p>
        <ul className="legal-list">
          <li>
            view the space in person, or by live video call with the current resident, before you pay or sign anything;
          </li>
          <li>
            confirm that the person you are dealing with is the current leaseholder, for example by reviewing the lease
            and confirming with the landlord or property manager;
          </li>
          <li>
            never pay by wire transfer, gift card, cryptocurrency or a peer-to-peer payment app to someone you have not
            met and verified, and never pay a “holding fee” to see a place;
          </li>
          <li>keep payment records, and pay through a traceable method where one is available; and</li>
          <li>keep your conversations on Handoff, so there is a record that our moderators can review if needed.</li>
        </ul>
        <p>Warning signs include:</p>
        <ul className="legal-list">
          <li>rent that is far below comparable listings, or photos that appear elsewhere online;</li>
          <li>a lister who is “out of the country” or otherwise unable to show the space;</li>
          <li>requests to move the conversation off Handoff right away, or to pay before viewing; and</li>
          <li>pressure to decide immediately, or reluctance to put the terms in writing.</li>
        </ul>
        <p>
          Handoff will never ask for your password, verification code or payment card details in a message. If you
          see any of these warning signs, please stop, do not send money, and report the listing or member.
        </p>
      </>
    ),
  },
  {
    id: 'writing',
    title: 'Putting the Arrangement in Writing',
    body: (
      <>
        <p>
          A clear written agreement protects everyone. Before anyone moves in, we encourage the parties to:
        </p>
        <ul className="legal-list">
          <li>
            confirm that the lease permits a sublease or assignment, and obtain any required landlord consent in
            writing;
          </li>
          <li>
            sign a written sublease or assignment that states the rent, deposit, dates, utilities, responsibility for
            damage and how the deposit will be returned;
          </li>
          <li>document the condition of the space with dated photos at move-in and move-out; and</li>
          <li>
            seek independent advice when unsure. CSU students may request a free lease review from CSU Student Legal
            Services.
          </li>
        </ul>
        <p>
          Under many leases, the original tenant remains responsible to the landlord for rent and damage during a
          sublease. Please understand your obligations before you commit.
        </p>
      </>
    ),
  },
  {
    id: 'meeting',
    title: 'Meeting and Touring Safely',
    body: (
      <ul className="legal-list">
        <li>Tell a trusted person where you are going and when you expect to return, or share your location with them.</li>
        <li>Bring a friend if you can, and schedule visits during daylight hours where possible.</li>
        <li>Meet first in a public place if that would make you more comfortable.</li>
        <li>Offer or request a live video tour as an alternative to an in-person visit.</li>
        <li>
          Trust your judgment. You are never obligated to enter a space, continue a visit or proceed with an
          arrangement that makes you uncomfortable, and you do not need to give a reason.
        </li>
      </ul>
    ),
  },
  {
    id: 'privacy',
    title: 'Protecting Your Privacy',
    body: (
      <ul className="legal-list">
        <li>
          Handoff shows only an approximate area for each listing. Share an exact address only when you are ready to
          arrange a visit with someone you have spoken with.
        </li>
        <li>
          Do not share government identification numbers, bank or card numbers, or your Handoff password with anyone.
        </li>
        <li>
          Share personal details, such as your schedule or your gender, only if and when you are comfortable doing so.
        </li>
      </ul>
    ),
  },
  {
    id: 'respect',
    title: 'Respect, Inclusion and Fair Housing',
    body: (
      <>
        <p>
          Handoff welcomes students of every background, identity and ability. Every member is expected to treat others
          with courtesy and respect. In particular:
        </p>
        <ul className="legal-list">
          <li>
            Housing decisions may not be based on race, color, religion, creed, national origin, ancestry, sex, sexual
            orientation, gender identity, gender expression, marital or familial status, disability, source of income,
            veteran or military status, or any other characteristic protected by law. The limited exception for stating
            a gender preference in shared living spaces is described in our <Link to="/terms#fair-housing">Terms</Link>.
          </li>
          <li>
            Use the names and pronouns people share with you. Harassment, slurs and demeaning language of any kind are
            not tolerated.
          </li>
          <li>
            Respond respectfully to requests for reasonable accommodations from people with disabilities. Assistance
            animals are not pets under fair housing law.
          </li>
          <li>
            Describe your space accurately, including accessibility features and barriers such as stairs, so others can
            make informed decisions.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'reporting',
    title: 'Reporting and Blocking',
    body: (
      <>
        <p>
          If a listing or member seems fraudulent, discriminatory, abusive or unsafe, please use the Report option on
          the listing or in the conversation. You may also block a member, which ends further messages from them.
          Reports are reviewed by our moderators, and we may hide listings or suspend accounts while we investigate.
          You can also contact us at <Mail to={SUPPORT_EMAIL} />.
        </p>
        <p>
          <strong>If you are in immediate danger, call or text 911.</strong> Handoff cannot dispatch emergency services.
        </p>
      </>
    ),
  },
  {
    id: 'resources',
    title: 'Resources',
    body: (
      <ul className="legal-list resource-list">
        <li>
          <strong>Emergency:</strong> call or text <Tel n="911" />
        </li>
        <li>
          <strong>CSU Police Department</strong> (non-emergency): <Tel n="970-491-6425" />
        </li>
        <li>
          <strong>Fort Collins Police Services</strong> (non-emergency): <Tel n="970-419-3273" />
        </li>
        <li>
          <strong>CSU SAFE Center Victim Assistance Team</strong> (confidential, 24 hours a day):{' '}
          <Tel n="970-492-4242" />
        </li>
        <li>
          <strong>CSU Student Legal Services</strong> (lease review and tenant questions): <Tel n="970-491-1482" />,
          Lory Student Center, Room 274
        </li>
        <li>
          <strong>CSU Off-Campus Life</strong> (off-campus housing and roommate resources): <Tel n="970-491-2248" />
        </li>
        <li>
          <strong>Housing discrimination:</strong>{' '}
          <Ext href="https://ccrd.colorado.gov/discrimination">Colorado Civil Rights Division</Ext> or the{' '}
          <Ext href="https://www.hud.gov/fairhousing">U.S. Department of Housing and Urban Development</Ext>
        </li>
        <li>
          <strong>Report a scam:</strong> <Ext href="https://reportfraud.ftc.gov/">Federal Trade Commission</Ext> or,
          for online fraud, the <Ext href="https://www.ic3.gov/">FBI Internet Crime Complaint Center</Ext>
        </li>
      </ul>
    ),
  },
]

export default function Safety() {
  return (
    <LegalDoc
      title="Safety Guidelines"
      intro={
        <p>
          Everyone deserves to find housing safely and to be treated with respect. These guidelines describe practices
          that can help protect you when you list, search for, visit or agree to a sublease. They supplement, and do
          not replace, our <Link to="/terms">Terms of Service</Link>.
        </p>
      }
      sections={sections}
      footnote={
        <p>
          These guidelines provide general information only and do not constitute legal advice. Handoff does not
          screen members, inspect properties or guarantee the outcome of any arrangement. Phone numbers were confirmed
          on the effective date above and may change.
        </p>
      }
    />
  )
}
