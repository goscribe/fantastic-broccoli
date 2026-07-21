"use client";

import { LegalSection, MarketingPage } from "@/components/layout/marketing-page";

export default function TermsPage() {
  return (
    <MarketingPage title="Terms of service" updated="July 2026">
      <LegalSection heading="Your account">
        <p>
          You are responsible for your account and for keeping your credentials
          secure. You must provide accurate information when signing up and be
          old enough to consent to these terms in your jurisdiction.
        </p>
      </LegalSection>
      <LegalSection heading="Your content">
        <p>
          You retain ownership of the materials you upload. You grant Scribe a
          limited licence to process them — parsing, transcription, and AI
          generation — solely to provide the service to you and your workspace
          members. Only upload materials you have the right to use.
        </p>
      </LegalSection>
      <LegalSection heading="Acceptable use">
        <p>
          Don&apos;t use Scribe to violate the law, infringe others&apos;
          rights, attempt to disrupt the service, or misuse AI generation
          (e.g. bulk scraping generated content). We may suspend accounts that
          break these rules.
        </p>
      </LegalSection>
      <LegalSection heading="Plans and billing">
        <p>
          Free plans have storage and generation limits. Paid plans renew
          monthly until cancelled; you can switch or cancel from the pricing
          page in the app at any time.
        </p>
      </LegalSection>
      <LegalSection heading="Disclaimers">
        <p>
          Study content is AI-generated from your materials and may contain
          mistakes — always verify against your course sources. The service is
          provided &quot;as is&quot; without warranties, and our liability is
          limited to the amount you paid in the last 12 months.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          Questions about these terms? Contact us at support@scribe.study.
        </p>
      </LegalSection>
    </MarketingPage>
  );
}
