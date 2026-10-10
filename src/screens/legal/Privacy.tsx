import { Link } from 'react-router'
import { OPERATOR_NAME, SUPPORT_EMAIL } from '../../config'
import { Ext, LegalDoc, Mail } from './LegalDoc'
import type { LegalSection } from './LegalDoc'

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: 'Who We Are and What This Policy Covers',
    body: (
      <p>
        This Privacy Policy describes how {OPERATOR_NAME}, doing business as Handoff (“Handoff,” “we,” “us” or “our”),
        collects, uses, discloses and protects personal information in connection with the Handoff website, web
        application, any mobile applications and related services (the “Service”). It applies to members and to
        visitors who browse without an account. Capitalized terms not defined here have the meanings given in our{' '}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    ),
  },
  {
    id: 'collect',
    title: 'Information We Collect',
    body: (
      <>
        <p>
          <strong>Information you provide.</strong>
        </p>
        <ul className="legal-list">
          <li>
            <em>Account information:</em> your first name, university email address and password. Passwords are
            handled by our authentication provider and are never visible to us.
          </li>
          <li>
            <em>Profile information (optional):</em> a profile photo, class year, a short bio and your gender, if you
            choose to provide it.
          </li>
          <li>
            <em>Listing information:</em> the details, photos, dates and rent you enter; the property’s exact street
            address; and an approximate location derived from it.
          </li>
          <li>
            <em>Communications:</em> messages, photos and documents you send to other members, and any messages you
            send to us.
          </li>
          <li>
            <em>Safety and activity records:</em> reports you submit, members you block, places you save, and whether
            you report that a listing was filled through Handoff.
          </li>
        </ul>
        <p>
          <strong>Information collected automatically.</strong>
        </p>
        <ul className="legal-list">
          <li>
            <em>Device and log data:</em> such as IP address, browser and device type, and timestamps, which our
            infrastructure providers process to deliver and secure the Service.
          </li>
          <li>
            <em>Listing view counts:</em> a random identifier stored in your browser, used only to count unique daily
            views of a listing. It is not linked to your name.
          </li>
          <li>
            <em>Usage analytics:</em> information about how the Service is used (for example, pages viewed and
            features used) collected through Google Analytics for Firebase, unless you opt out (see Section 6).
          </li>
          <li>
            <em>On-device storage:</em> your theme, analytics choice, recent search and unfinished listing drafts are
            stored in your browser so the Service works as expected. We do not use advertising cookies.
          </li>
        </ul>
        <p>
          <strong>Information from others.</strong> Other members may provide information about you, for example in a
          message or a report.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How We Use Information',
    body: (
      <>
        <p>We use personal information to:</p>
        <ul className="legal-list">
          <li>create and secure your account and verify your university email address;</li>
          <li>publish listings, display them on maps and in search, and enable messaging between members;</li>
          <li>
            show places that may be open to you, if you choose to provide your gender, and show listers aggregate
            statistics such as view and save counts;
          </li>
          <li>
            detect, investigate and prevent fraud, abuse, discrimination, security incidents and violations of our
            Terms, and review reports;
          </li>
          <li>
            communicate with you about your account, including verification, security and service notices, and, unless
            you turn them off, emails letting you know about new messages;
          </li>
          <li>understand usage and improve the Service, using aggregated or de-identified information where possible;</li>
          <li>process payments for optional paid features, if offered; and</li>
          <li>comply with legal obligations and enforce our rights.</li>
        </ul>
        <p>We do not use personal information to make decisions that produce legal or similarly significant effects about you solely through automated processing.</p>
      </>
    ),
  },
  {
    id: 'share',
    title: 'How Information Is Shared',
    body: (
      <>
        <p>
          <strong>With other members and visitors.</strong> Listings, including their photos, rent, dates, approximate
          area and the lister’s first name, profile photo, class year and member-since date, are visible to anyone
          using the Service. When you message another member, they can see your first name, profile photo and the
          messages and files you send. A listing’s exact address is shared only if the lister chooses to share it in a
          conversation. Your email address, gender and saved places are not shown to other members.
        </p>
        <p>
          <strong>With service providers</strong> who process information on our behalf and under our instructions:
        </p>
        <ul className="legal-list">
          <li>Google (Firebase) for authentication, database, file storage, hosting and analytics;</li>
          <li>OpenFreeMap, which receives your IP address when your device loads map images;</li>
          <li>Photon by Komoot, which receives the text of address searches when a lister enters an address;</li>
          <li>Resend, which delivers new-message email notifications on our behalf; and</li>
          <li>Stripe, if you purchase a paid feature on the web, to process your payment.</li>
        </ul>
        <p>
          <strong>For legal and safety reasons.</strong> We may disclose information if we believe in good faith that
          it is reasonably necessary to comply with law or legal process, to protect the rights, property or safety
          of any person, or to investigate fraud or violations of our Terms.
        </p>
        <p>
          <strong>Business transfers.</strong> If Handoff is involved in a merger, acquisition, financing or sale of
          assets, information may be transferred as part of that transaction, subject to this Policy.
        </p>
        <p>
          <strong>With your direction or consent.</strong>
        </p>
        <p>
          <strong>We do not sell personal information, and we do not share it for cross-context behavioral
          advertising.</strong> The Service does not display third-party advertising.
        </p>
      </>
    ),
  },
  {
    id: 'sensitive',
    title: 'Gender and Other Sensitive Information',
    body: (
      <p>
        Providing your gender is entirely optional, and you may describe it in your own words or decline to say. If you
        provide it, it is visible only to you and is used solely to show listings that are open to you. You may change
        or remove it at any time in your profile. We ask that you not include health information, government
        identification numbers, financial account numbers or similar sensitive information in your profile, listings
        or messages.
      </p>
    ),
  },
  {
    id: 'choices',
    title: 'Your Choices and Rights',
    body: (
      <>
        <ul className="legal-list">
          <li>
            <em>Access and correction:</em> you can view and update your profile and listings in the Service at any
            time.
          </li>
          <li>
            <em>Deletion:</em> you can delete your account in Account settings. See{' '}
            <Link to="/delete-account">Delete your Handoff account</Link> for what is removed.
          </li>
          <li>
            <em>Analytics:</em> you can turn off usage analytics in Account settings. If your browser sends a Global
            Privacy Control signal, analytics start turned off.
          </li>
          <li>
            <em>Communications:</em> you can turn off new-message emails in Account settings or from the link in any
            such email. Service-related messages, such as verification and security notices, are part of the Service
            and cannot be opted out of while you hold an account.
          </li>
        </ul>
        <p>
          Depending on where you live, you may have rights under laws such as the Colorado Privacy Act to confirm
          whether we process your personal information, and to access, correct, delete or obtain a portable copy of
          it, and to opt out of sale, targeted advertising or certain profiling. Whether or not those laws apply to
          Handoff, we will honor reasonable requests from any member. To make a request, email{' '}
          <Mail to={SUPPORT_EMAIL} /> from the address associated with your account. We will respond within 45 days,
          may need to verify your identity, and will not discriminate against you for exercising your rights. If we
          decline your request, you may appeal by replying to our decision, and we will respond to the appeal within
          45 days.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'Data Retention',
    body: (
      <>
        <p>
          We keep personal information for as long as your account is active and as needed to provide the Service.
          When you delete your account, we delete your profile, listings (including photos and exact addresses), saved
          places and blocked list, and your login. Messages you have already sent remain visible to the recipient, with
          your name replaced by “Former member.” Listings that were hidden or removed for review, reports, and records
          of moderation actions are retained as long as reasonably necessary for safety, fraud prevention and legal
          purposes.
        </p>
        <p>
          Residual copies may remain in our providers’ systems for a limited period before they are overwritten.
          Analytics data is retained according to our analytics settings and is not linked to your name.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        We use reasonable administrative, technical and physical safeguards designed to protect personal information,
        including encryption in transit, access rules that limit who can read each type of data, and storing exact
        addresses separately from public listing data. No method of transmission or storage is completely secure, and
        we cannot guarantee absolute security. If we learn of a security breach affecting your personal information,
        we will notify you as required by law.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Individuals Under 18',
    body: (
      <p>
        The Service is intended for adults aged 18 and older and is not directed to children. We do not knowingly
        collect personal information from anyone under 18. If you believe a person under 18 has provided us with
        personal information, please contact us and we will delete it.
      </p>
    ),
  },
  {
    id: 'university',
    title: 'Relationship to Colorado State University',
    body: (
      <p>
        Handoff is independent and is not affiliated with Colorado State University. We use your university email
        address only to confirm that you are a current student. We do not receive education records from the
        university, and we do not share your information with the university except as described in Section 4.
      </p>
    ),
  },
  {
    id: 'location',
    title: 'Where Information Is Processed',
    body: (
      <p>
        Handoff is operated from the United States. Our service providers may process information in the United States
        and other countries where they operate, which may have data protection laws different from those of your
        jurisdiction.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    body: (
      <p>
        We may update this Policy from time to time. If we make material changes, we will update the effective date
        above and provide reasonable notice through the Service or by email before the changes take effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact Us',
    body: (
      <p>
        For questions or requests about this Policy or your personal information, contact us at{' '}
        <Mail to={SUPPORT_EMAIL} />. You may also learn more about your rights from the{' '}
        <Ext href="https://coag.gov/resources/colorado-privacy-act/">Colorado Attorney General</Ext>.
      </p>
    ),
  },
]

export default function Privacy() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro={
        <p>
          Your privacy matters to us. This Policy explains what information Handoff collects, why we collect it, who
          can see it, and the choices you have. In short: we collect what the Service needs to work and to keep members
          safe, we never sell your information, and you can delete your account at any time.
        </p>
      }
      sections={sections}
    />
  )
}
