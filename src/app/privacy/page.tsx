"use client";

import { LegalSection, MarketingPage } from "@/components/layout/marketing-page";

export default function PrivacyPage() {
  return (
    <MarketingPage title="Privacy policy" updated="July 2026">
      <LegalSection heading="What we collect">
        <p>
          When you create an account we collect your name, email address, and
          password. When you use Scribe we store the study materials you upload
          (PDFs, slides, notes, and audio recordings), the study content
          generated from them, and your study activity (session progress,
          answers, and chat messages with the copilot).
        </p>
      </LegalSection>
      <LegalSection heading="How we use your data">
        <p>
          Your uploads are used solely to build your study materials: parsing
          documents, transcribing audio, and generating readings, worksheets,
          flashcards, study guides, and podcast episodes for your workspaces.
          Material content is sent to AI model providers to perform this
          generation. We do not sell your data or use your materials to train
          models.
        </p>
      </LegalSection>
      <LegalSection heading="Sharing">
        <p>
          Content in a workspace is visible to that workspace&apos;s members.
          You control who is invited. We share data with service providers only
          as needed to run Scribe (hosting, storage, AI generation, payments).
        </p>
      </LegalSection>
      <LegalSection heading="Retention and deletion">
        <p>
          You can delete uploaded materials, generated study guides, and other
          content from your workspaces at any time; deleted files are also
          removed from storage. Deleting your account removes your personal
          data from our systems.
        </p>
      </LegalSection>
      <LegalSection heading="Contact">
        <p>
          Questions about this policy? Contact us at support@scribe.study.
        </p>
      </LegalSection>
    </MarketingPage>
  );
}
