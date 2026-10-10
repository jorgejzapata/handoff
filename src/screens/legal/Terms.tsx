import { Link } from 'react-router'
import { OPERATOR_NAME, SUPPORT_EMAIL } from '../../config'
import { LegalDoc, Mail } from './LegalDoc'
import type { LegalSection } from './LegalDoc'

const PROTECTED =
  'race (including hair texture, hair type and protective hairstyles), color, religion, creed, national origin, ancestry, sex, sexual orientation, gender identity, gender expression, marital status, familial status, disability, source of income, veteran or military status, or any other characteristic protected by applicable federal, state or local law'

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Acceptance of These Terms',
    body: (
      <>
        <p>
          These Terms of Service (the “Terms”) form a legally binding agreement between you and {OPERATOR_NAME},
          doing business as Handoff (“Handoff,” “we,” “us” or “our”), and govern your access to and use of the Handoff
          website, web application, any mobile applications and all related features and services (together, the
          “Service”).
        </p>
        <p>
          By creating an account, posting a listing, sending a message or otherwise using the Service, you confirm
          that you have read, understood and agree to be bound by these Terms and by our{' '}
          <Link to="/privacy">Privacy Policy</Link>, which is incorporated into these Terms by reference. If you do not
          agree, you may not use the Service.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility and Accounts',
    body: (
      <>
        <p>To create an account and use the Service’s member features, you must:</p>
        <ul className="legal-list">
          <li>be at least 18 years of age and legally able to enter into a binding contract;</li>
          <li>
            be a current student at a college or university and verify a school email address that we accept
            (currently addresses ending in .edu);
          </li>
          <li>not have been previously suspended or removed from the Service; and</li>
          <li>not be prohibited from using the Service under any applicable law.</li>
        </ul>
        <p>
          You agree to provide accurate information, to keep it current, to maintain only one account, and to keep
          your login credentials confidential. You are responsible for all activity that occurs under your account.
          Please notify us promptly at <Mail to={SUPPORT_EMAIL} /> if you believe your account has been accessed
          without your permission.
        </p>
        <p>
          Email verification confirms only that you controlled a university email address at the time of
          verification. It does not constitute an identity check, a background check or an endorsement of any member.
        </p>
      </>
    ),
  },
  {
    id: 'role',
    title: 'What Handoff Is, and What It Is Not',
    body: (
      <>
        <p>
          Handoff is an online venue that allows members to publish and discover listings for subleases, rooms in
          shared housing and lease takeovers, and to communicate with one another. Handoff:
        </p>
        <ul className="legal-list">
          <li>
            is not a landlord, property owner, property manager, real estate broker or agent, and does not represent
            any member in any transaction;
          </li>
          <li>
            is not a party to any sublease, lease assignment, roommate agreement or other arrangement between members
            or between a member and a landlord;
          </li>
          <li>
            does not own, inspect, verify, appraise or guarantee any property, listing, member or statement made on
            the Service;
          </li>
          <li>
            does not collect, hold or transmit rent, security deposits or other housing payments, and does not
            negotiate terms on anyone’s behalf; and
          </li>
          <li>
            is an independent service that is not affiliated with, sponsored by or endorsed by any college or
            university.
          </li>
        </ul>
        <p>
          Any agreement you make with another member is solely between you and that member (and, where applicable,
          the landlord). You are responsible for evaluating every listing, member and arrangement for yourself.
        </p>
      </>
    ),
  },
  {
    id: 'listings',
    title: 'Listings and Lease Compliance',
    body: (
      <>
        <p>If you publish a listing, you represent and warrant that:</p>
        <ul className="legal-list">
          <li>
            you hold the legal right to offer the space, including any consent your lease or landlord requires before
            you sublease, assign your lease or add an occupant, and you will obtain that consent before any person
            moves in;
          </li>
          <li>
            the listing is accurate and complete in all material respects, including the rent, dates, fees, deposit,
            condition of the space and the status of landlord approval, and you will update or remove it promptly if
            anything changes;
          </li>
          <li>
            you own or have permission to use every photo and file you upload, and your photos fairly depict the
            space being offered; and
          </li>
          <li>the listing complies with these Terms and with all applicable laws, including fair housing laws.</li>
        </ul>
        <p>
          Handoff displays only an approximate area for each listing. The exact address is stored privately and is
          disclosed only if you choose to share it in a conversation. Listings remain active for up to 90 days or
          until the move-out date, whichever occurs first, after which they expire unless renewed. We may edit
          formatting, decline to publish, limit the visibility of, or remove any listing at our discretion.
        </p>
        <p>
          Breaching a lease can expose the parties to eviction, fees or other liability. We encourage every member to
          read their lease carefully and, where appropriate, seek independent legal advice. Many colleges and
          universities offer students free lease review through a student legal services office.
        </p>
      </>
    ),
  },
  {
    id: 'fair-housing',
    title: 'Fair Housing and Nondiscrimination',
    body: (
      <>
        <p>
          Handoff is committed to an inclusive community in which every person is treated with dignity and has equal
          access to housing opportunities. You agree to comply with the federal Fair Housing Act and all applicable
          state and local fair housing and civil rights laws, such as the Colorado Anti-Discrimination Act where it
          applies.
        </p>
        <p>
          You may not refuse to rent to, set different terms for, steer, harass or otherwise discriminate against any
          person, and you may not publish any listing, statement or preference that indicates a limitation or
          discrimination, on the basis of {PROTECTED}.
        </p>
        <p>
          <strong>Shared living spaces.</strong> Where a listing offers a room within a dwelling that the new occupant
          will share with current residents, the Service permits the lister to state who currently lives in the
          dwelling and a preference regarding the gender of the person who will share that living space, solely to
          the extent permitted by applicable law. This option is not available for, and may not be used in, listings
          for an entire unit or lease takeover. No listing may express a preference based on any other protected
          characteristic. Where a preference is stated, the categories “women” and “men” include transgender and
          cisgender people alike.
        </p>
        <p>
          <strong>Reasonable accommodations.</strong> You must consider requests for reasonable accommodations and
          modifications made by or on behalf of persons with disabilities as required by law. Assistance animals,
          including service animals and emotional support animals, are not pets for purposes of fair housing law, and
          a “no pets” statement does not by itself justify refusing an assistance animal.
        </p>
        <p>
          We may remove any content and suspend any account that we believe, in our reasonable judgment, violates
          this section. If you believe you have experienced housing discrimination, you may also contact the U.S.
          Department of Housing and Urban Development or your state’s civil rights agency. Resources are listed in our{' '}
          <Link to="/safety">Safety Guidelines</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'conduct',
    title: 'Community Standards and Prohibited Conduct',
    body: (
      <>
        <p>You agree not to, and not to attempt to:</p>
        <ul className="legal-list">
          <li>
            post a listing for a space you do not have the right to offer, or any fraudulent, misleading, duplicate or
            “bait” listing;
          </li>
          <li>
            request or accept payment before the other person has had a reasonable opportunity to view the space and
            review the terms, or request payment by wire transfer, gift card, cryptocurrency or other untraceable
            methods in connection with a scheme to defraud;
          </li>
          <li>
            harass, threaten, intimidate, bully, stalk, demean or discriminate against any person, including by
            misgendering or using slurs or hateful language;
          </li>
          <li>post sexually explicit content, or content that is violent, hateful, defamatory or unlawful;</li>
          <li>
            impersonate any person, misrepresent your identity, affiliation or student status, or create an account
            on behalf of another person;
          </li>
          <li>
            collect or publish another person’s personal information, including an exact address, without consent;
          </li>
          <li>
            use the Service for advertising unrelated to a genuine housing listing, spam, chain messages or commercial
            solicitation, or to post listings on behalf of a property management business without our written consent;
          </li>
          <li>
            scrape, crawl, copy or harvest data from the Service, or access it through automated means except as we
            expressly permit;
          </li>
          <li>
            interfere with, disrupt, probe or circumvent the security, rules or access controls of the Service; or
          </li>
          <li>violate any applicable law, any third party’s rights, or these Terms.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'messaging',
    title: 'Messaging and Communications',
    body: (
      <>
        <p>
          The Service allows verified members to exchange messages, photos and documents. Messages are delivered to
          the members in the conversation and may be reviewed by us when reported, when reasonably necessary to
          investigate a violation of these Terms, to protect the safety of any person, or as required by law. Please
          do not send government identification numbers, financial account numbers or other highly sensitive
          information through the Service.
        </p>
        <p>
          You may block another member at any time. Blocking prevents further messages in that conversation. By
          providing your email address, you consent to receive service-related communications from us, such as
          verification and password-reset messages and notices about your account.
        </p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your Content and License to Handoff',
    body: (
      <>
        <p>
          You retain ownership of the listings, photos, messages, files and other content you submit (“Your
          Content”). You grant Handoff a worldwide, non-exclusive, royalty-free, sublicensable license to host, store,
          reproduce, display, adapt (for example, by resizing images) and distribute Your Content solely to operate,
          provide, promote and improve the Service. This license ends when Your Content is deleted from the Service,
          except for copies retained as described in our Privacy Policy or that other members have already received.
        </p>
        <p>
          You are solely responsible for Your Content. We do not endorse any content submitted by members, and we
          have no obligation to monitor it, although we may do so.
        </p>
      </>
    ),
  },
  {
    id: 'moderation',
    title: 'Reporting, Moderation, Suspension and Termination',
    body: (
      <>
        <p>
          Members may report listings and other members through the Service. We review reports and may, at our
          discretion and without prior notice, hide or remove content, limit features, suspend or terminate accounts,
          or take other action we consider appropriate, including where we reasonably believe it necessary to protect
          members, third parties or the Service. Where practical and lawful, we will tell you about action taken
          against your account and how to contact us about it.
        </p>
        <p>
          You may stop using the Service and delete your account at any time from Account settings. Sections of these
          Terms that by their nature should survive termination, including Sections 3, 8, 12 through 18 and 21, will survive.
        </p>
      </>
    ),
  },
  {
    id: 'paid',
    title: 'Paid Features',
    body: (
      <>
        <p>
          Posting a listing is free. We may offer optional paid features, such as promoting (“boosting”) a listing for
          a set period. If you purchase a paid feature, you agree to pay the price displayed at checkout, including
          applicable taxes. Payments made on the web are processed by our payment processor, Stripe, and purchases
          made in a mobile application may be processed by the applicable app store under its terms.
        </p>
        <p>
          A paid feature increases a listing’s visibility; it does not guarantee any number of views, messages or a
          successful rental. Except where required by law or expressly stated at the time of purchase, payments are
          non-refundable, including if a listing is removed for violating these Terms. Prices and features may change
          prospectively at any time.
        </p>
      </>
    ),
  },
  {
    id: 'privacy',
    title: 'Privacy',
    body: (
      <p>
        Our <Link to="/privacy">Privacy Policy</Link> explains how we collect, use and share personal information. By
        using the Service, you acknowledge that your information will be handled as described there.
      </p>
    ),
  },
  {
    id: 'ip',
    title: 'Intellectual Property and Feedback',
    body: (
      <p>
        The Service, including its software, design, text, graphics, logos and the Handoff name, is owned by us or our
        licensors and is protected by intellectual property laws. Subject to these Terms, we grant you a limited,
        revocable, non-exclusive, non-transferable license to use the Service for its intended, personal,
        non-commercial purpose. If you send us suggestions or feedback, you agree that we may use them without
        restriction or compensation to you.
      </p>
    ),
  },
  {
    id: 'copyright',
    title: 'Copyright Complaints',
    body: (
      <p>
        We respect intellectual property rights. If you believe content on the Service infringes your copyright,
        please send a notice to <Mail to={SUPPORT_EMAIL} /> that identifies the copyrighted work, the material you
        believe is infringing and where it appears, your contact information, a statement that you have a good-faith
        belief the use is not authorized, and a statement, under penalty of perjury, that the information in your
        notice is accurate and that you are the owner or are authorized to act on the owner’s behalf, together with
        your physical or electronic signature. We may remove material and terminate the accounts of repeat
        infringers.
      </p>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-Party Services',
    body: (
      <p>
        The Service relies on and may link to services provided by third parties, such as mapping, address search,
        hosting and payment providers. We are not responsible for third-party services, and your use of them may be
        subject to their own terms and privacy policies.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p className="legal-caps">
        To the maximum extent permitted by law, the Service is provided “as is” and “as available,” without warranties
        of any kind, whether express, implied or statutory, including any implied warranties of merchantability,
        fitness for a particular purpose, title, non-infringement and quiet enjoyment. We do not warrant that the
        Service will be uninterrupted, secure or error-free, that any listing or member is genuine, accurate, safe or
        lawful, or that any housing arrangement will be completed. You assume all risk arising from your interactions
        with other members, including meetings in person and visits to any property.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    body: (
      <>
        <p className="legal-caps">
          To the maximum extent permitted by law, Handoff and its operator, affiliates, contractors and licensors will
          not be liable for any indirect, incidental, special, consequential, exemplary or punitive damages, or for any
          loss of profits, revenue, data, goodwill, housing or use, arising out of or relating to the Service, any
          content, any member or any housing arrangement, even if advised of the possibility of such damages.
        </p>
        <p className="legal-caps">
          To the maximum extent permitted by law, our total liability for all claims arising out of or relating to the
          Service or these Terms will not exceed the greater of one hundred U.S. dollars (US$100) or the amount you
          paid us for paid features in the twelve months before the event giving rise to the claim.
        </p>
        <p>
          Some jurisdictions do not allow certain limitations or exclusions, so some of the above may not apply to
          you. Nothing in these Terms limits liability that cannot be limited by law, including for gross negligence or
          willful misconduct.
        </p>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnification',
    body: (
      <p>
        To the extent permitted by law, you agree to defend, indemnify and hold harmless Handoff and its operator,
        affiliates and contractors from and against any claims, liabilities, damages, losses and expenses, including
        reasonable attorneys’ fees, arising out of or relating to Your Content, your use of the Service, any
        arrangement you enter into with another member or a landlord, or your violation of these Terms or of any law
        or third-party right.
      </p>
    ),
  },
  {
    id: 'disputes',
    title: 'Dispute Resolution, Governing Law and Venue',
    body: (
      <>
        <p>
          Before filing a claim against Handoff, you agree to contact us at <Mail to={SUPPORT_EMAIL} /> with a
          description of the dispute and to allow thirty (30) days to attempt to resolve it informally.
        </p>
        <p>
          These Terms are governed by the laws of the State of Colorado, without regard to its conflict-of-laws rules,
          and, where applicable, the federal laws of the United States. Any dispute that is not resolved informally
          will be brought exclusively in the state courts located in Larimer County, Colorado, or the United States
          District Court for the District of Colorado, and you and we consent to the personal jurisdiction of those
          courts. Either party may instead bring an individual claim in small claims court if it qualifies.
        </p>
        <p>
          Disputes between members are solely between those members. We may, but are not required to, assist in
          resolving them.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to the Service and These Terms',
    body: (
      <p>
        We may modify, suspend or discontinue any part of the Service at any time. We may update these Terms from time
        to time. If we make material changes, we will update the effective date above and provide reasonable notice,
        such as through the Service or by email, before the changes take effect. Your continued use of the Service
        after the changes take effect constitutes acceptance of the updated Terms.
      </p>
    ),
  },
  {
    id: 'app-stores',
    title: 'Mobile Applications',
    body: (
      <p>
        If you obtain a Handoff mobile application from the Apple App Store or Google Play, you acknowledge that these
        Terms are between you and Handoff only, not the app store provider. The app store provider has no obligation to
        provide maintenance or support for the application and is not responsible for addressing any claims relating
        to it. Apple Inc. and its subsidiaries are third-party beneficiaries of these Terms with respect to any
        application downloaded from the Apple App Store and may enforce these Terms against you as such.
      </p>
    ),
  },
  {
    id: 'general',
    title: 'General Provisions',
    body: (
      <p>
        These Terms, together with the Privacy Policy and any terms presented at the time of a purchase, are the entire
        agreement between you and Handoff regarding the Service. If any provision is held unenforceable, the remaining
        provisions will remain in full force and effect. Our failure to enforce any provision is not a waiver. You may
        not assign these Terms without our prior written consent; we may assign them in connection with a merger,
        acquisition, reorganization or sale of assets. We are not liable for any delay or failure to perform caused by
        events beyond our reasonable control. Headings are for convenience only.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these Terms may be sent to <Mail to={SUPPORT_EMAIL} />.
      </p>
    ),
  },
]

export default function Terms() {
  return (
    <LegalDoc
      title="Terms of Service"
      intro={
        <p>
          Please read these Terms carefully. They describe your rights and responsibilities when you use Handoff, the
          limits of what Handoff does, and how disputes are resolved. Sections 15 and 16 limit our liability.
        </p>
      }
      sections={sections}
    />
  )
}
