"use client";

import { LegalSection, MarketingPage } from "@/components/layout/marketing-page";

export default function TermsPage() {
  return (
    <MarketingPage title="Terms of service" updated="August 2026">
      <LegalSection heading="Agreement">
        <p>
          These terms govern your use of Scribe. By creating an account or
          using the service you accept them. If you use Scribe on behalf of a
          school or organisation, you confirm you are authorised to accept
          these terms for it.
        </p>
      </LegalSection>
      <LegalSection heading="Your account">
        <p>
          You are responsible for your account and for keeping your credentials
          secure. You must provide accurate information when signing up and be
          old enough to consent to these terms in your jurisdiction. You may
          sign in with an email and password or with a third-party provider
          such as Google; when you do, we receive your basic profile details
          from that provider.
        </p>
      </LegalSection>
      <LegalSection heading="Your content">
        <p>
          You retain ownership of the materials you upload. You grant Scribe a
          limited licence to process them — parsing, transcription, indexing,
          and AI generation — solely to provide the service to you and your
          workspace members. Only upload materials you have the right to use.
        </p>
      </LegalSection>
      <LegalSection heading="Content review and curation">
        <p>
          Scribe generates study content automatically, so we review it for
          quality and safety. Authorised Scribe staff may access workspaces and
          the content generated in them to investigate quality issues, debug
          failed generations, respond to your support requests, and enforce
          these terms. Reviewers may hide generated content that is inaccurate,
          unsafe, or violates these terms. Staff access is limited to what is
          needed for those purposes and is recorded in our audit log.
        </p>
      </LegalSection>
      <LegalSection heading="Acceptable use">
        <p>
          Don&apos;t use Scribe to violate the law, infringe others&apos;
          rights, upload material you have no right to share, attempt to
          disrupt the service, resell or redistribute generated content at
          scale, or misuse AI generation (e.g. bulk scraping generated
          content, or automating requests to exhaust generation limits). We may
          suspend accounts that break these rules.
        </p>
      </LegalSection>
      <LegalSection heading="Plans, tokens, and billing">
        <p>
          Free plans have storage and generation limits. Paid plans renew
          monthly until cancelled; you can switch or cancel from the pricing
          page in the app at any time, and cancellation takes effect at the end
          of the current billing period. Generation consumes tokens from your
          monthly balance; unused tokens do not roll over, and one-off top-ups
          are non-refundable once spent.
        </p>
      </LegalSection>
      <LegalSection heading="Disclaimers">
        <p>
          Study content is AI-generated from your materials and may contain
          mistakes — always verify against your course sources. Scribe is a
          study aid, not academic, medical, legal, or professional advice, and
          you are responsible for complying with your institution&apos;s
          academic-honesty rules. The service is provided &quot;as is&quot;
          without warranties, and our liability is limited to the amount you
          paid in the last 12 months.
        </p>
      </LegalSection>
      <LegalSection heading="Termination">
        <p>
          You can delete your account at any time from settings. We may suspend
          or terminate accounts that breach these terms or create risk for
          other users. On deletion, your workspaces and their generated content
          are removed as described in our privacy policy.
        </p>
      </LegalSection>
      <LegalSection heading="Changes to these terms">
        <p>
          We may update these terms as Scribe evolves. Material changes will be
          announced in the app or by email before they take effect; continuing
          to use Scribe after that means you accept the updated terms.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>Questions about these terms? Contact us at support@scribe.study.</p>
      </LegalSection>
    </MarketingPage>
  );
}
